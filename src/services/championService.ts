// Data Dragon Champion Service
// Fetches champion data from Riot's Data Dragon CDN

interface ChampionData {
  id: string; // "Aatrox"
  key: string; // "266"
  name: string; // "Aatrox"
  title: string; // "the Darkin Blade"
  image: {
    full: string; // "Aatrox.png"
    sprite: string;
    group: string;
  };
}

interface ChampionsResponse {
  type: string;
  format: string;
  version: string;
  data: {
    [championName: string]: ChampionData;
  };
}

class ChampionService {
  private champions: Map<number, ChampionData> = new Map();
  private version: string = '';
  private isLoaded: boolean = false;

  /**
   * Fetch the latest Data Dragon version
   */
  private async getLatestVersion(): Promise<string> {
    const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions: string[] = await response.json();
    return versions[0]; // Latest version
  }

  /**
   * Load champion data from Data Dragon
   */
  async loadChampions(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // Get latest version
      this.version = await this.getLatestVersion();
      console.log(`[ChampionService] Loading champions for version ${this.version}`);

      // Fetch champion data
      const response = await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${this.version}/data/en_US/champion.json`
      );
      const data: ChampionsResponse = await response.json();

      // Map champions by their numeric ID
      Object.values(data.data).forEach(champion => {
        const championId = parseInt(champion.key);
        this.champions.set(championId, champion);
      });

      this.isLoaded = true;
      console.log(`[ChampionService] Loaded ${this.champions.size} champions`);
    } catch (error) {
      console.error('[ChampionService] Failed to load champions:', error);
    }
  }

  /**
   * Get champion data by numeric ID
   */
  getChampion(championId: number): ChampionData | undefined {
    return this.champions.get(championId);
  }

  /**
   * Get champion name with proper spacing
   */
  getChampionName(championId: number): string {
    const champion = this.champions.get(championId);
    if (!champion) return `Champion ${championId}`;

    // Data Dragon names already have proper spacing
    return champion.name;
  }

  /**
   * Get champion icon URL
   */
  getChampionIconUrl(championId: number): string {
    const champion = this.champions.get(championId);
    if (!champion) return '';

    return `https://ddragon.leagueoflegends.com/cdn/${this.version}/img/champion/${champion.image.full}`;
  }

  /**
   * Get champion square splash URL (bigger image)
   */
  getChampionSplashUrl(championId: number): string {
    const champion = this.champions.get(championId);
    if (!champion) return '';

    return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion.id}_0.jpg`;
  }

  /**
   * Get current Data Dragon version
   */
  getVersion(): string {
    return this.version;
  }
}

export const championService = new ChampionService();
