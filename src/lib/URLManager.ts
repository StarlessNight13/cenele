
export class URLManager {
  private scrollHandler: (() => void) | null = null;
  private intervalId: number | null = null;
  private readonly DEBOUNCE_DELAY = 50;
  private readonly UPDATE_INTERVAL = 1000;

  /**
   * Initializes the URL Manager and sets up event listeners
   */
  constructor() {
    this.initialize();
  }

  /**
   * Sets up all event listeners and interval updates
   */
  private initialize(): void {
    // Create the debounced scroll handler
    const updateURLOnScroll = this.debounce(() => {
      this.updateURLWithMostVisibleChapter();
    }, this.DEBOUNCE_DELAY);

    // Store reference to the handler for later removal
    this.scrollHandler = updateURLOnScroll;

    // Set up event listeners and intervals
    window.addEventListener("scroll", updateURLOnScroll);
    this.intervalId = window.setInterval(() => {
      this.updateURLWithMostVisibleChapter();
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Updates the URL based on the most visible chapter
   */
  private updateURLWithMostVisibleChapter(): void {
    const mostVisibleChapter = this.findMostVisibleChapter();
    this.updateURL(mostVisibleChapter);
  }

  /**
   * Updates the browser URL if a valid chapter is provided
   * @param chapter - The chapter element containing the URL data
   */
  private updateURL(chapter: HTMLElement | null): void {
    if (!chapter) return;

    const chapterUrl = chapter.getAttribute("data-url");
    if (chapterUrl && window.location.href !== chapterUrl) {
      history.replaceState({ chapterUrl }, "", chapterUrl);
    }
  }

  /**
   * Finds the chapter with the highest visibility percentage in the viewport
   * @returns The most visible chapter element or null if none meets the threshold
   */
  private findMostVisibleChapter(): HTMLElement | null {
    const readingContents =
      document.querySelectorAll<HTMLDivElement>(".chapter-container");
    if (!readingContents || readingContents.length === 0) return null;

    const chapters = Array.from(readingContents);
    const viewportHeight = window.innerHeight;
    let mostVisibleChapter: HTMLElement | null = null;
    let maxVisiblePercentage = 0;

    chapters.forEach((chapter) => {
      const rect = chapter.getBoundingClientRect();

      // Calculate visible height within viewport
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, viewportHeight);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      // Calculate percentage of chapter that is visible
      const chapterVisibleHeight = Math.min(rect.height, viewportHeight);
      const visiblePercentage =
        chapterVisibleHeight > 0
          ? (visibleHeight / chapterVisibleHeight) * 100
          : 0;

      if (visiblePercentage > maxVisiblePercentage) {
        maxVisiblePercentage = visiblePercentage;
        mostVisibleChapter = chapter;
      }
    });

    return maxVisiblePercentage > 30
      ? mostVisibleChapter
      : null;
  }

  /**
   * Creates a debounced version of the provided function
   * @param func - The function to debounce
   * @param wait - The debounce delay in milliseconds
   * @returns A debounced function
   */
  private debounce(func: Function, wait: number): (...args: any[]) => void {
    let timeoutId: number | undefined;

    return (...args: any[]) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Removes all event listeners and intervals to prevent memory leaks
   */
  public destroy(): void {
    // Remove scroll event listener
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = null;
    }

    // Clear the update interval
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
