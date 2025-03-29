/* @refresh reload */
import { render } from "solid-js/web";
import ChapterReader from "./ChapterPage"; // Assuming ChapterPage.tsx exports ChapterReader
import { Button } from "./components/ui/button";
import "./index.css";

// Define the shape of the chapter data we pass to the component
interface ChapterInfo {
  id: number; // Index in the list
  value: string; // URL or identifier for the chapter
  text: string; // Display text (e.g., "Chapter 5")
  selected: boolean; // Whether this was the initially selected chapter
}

interface InitialChapterData {
  id: number; // ID from data attribute (might be missing)
  uri: string;
  title: string;
  content: string;
}

// --- Helper Functions ---

/**
 * Removes specified CSS/JS links from the document head.
 */
function cleanupHeadScriptsAndStyles(): void {
  const selectorsToRemove: string[] = [
    "#bootstrap-css",
    "#bootstrap-js",
    "#jquery-js",
    "#jquery-css", // Note: original code had #jquery-css twice, removed duplicate selector
    "#fontawesome-css",
    "#fontawesome-js",
    "#toastr-js",
    "#toastr-css", // Note: original code had #toastr-css twice
    "#madara-css-css",
    "#child-style-css",
    "#slick-theme-css",
    "#slick-css",
    "#ionicons-css",
    "#madara-icons-css",
    "#loaders-css",
    "#wp-pagenavi-css",
    "#jquery-core-js",
    "#jquery-migrate-js",
    "#wp-custom-css",
    // Add any other specific selectors if needed
  ];

  selectorsToRemove.forEach((selector) => {
    document.head.querySelector(selector)?.remove();
  });
  console.log("Removed legacy scripts and styles.");
}

/**
 * Extracts the list of chapters from the dropdown menu.
 * Reverses the list, filters invalid options, and assigns an index-based ID.
 */
function extractChapterList(): ChapterInfo[] {
  const selectElements = document.querySelectorAll<HTMLSelectElement>(
    // More specific selector focusing on the select itself
    "#manga-reading-nav-head select.selectpicker_chapter" // Adjust if this selector isn't unique enough
    // Original selector was very long: "#manga-reading-nav-head > div > div.select-view > div.c-selectpicker.selectpicker_chapter.chapters_selectbox_holder > label> select"
  );

  if (!selectElements) {
    console.warn("Chapter select dropdown not found.");
    return [];
  }

  // 1. Get options, convert to array, reverse order (often newest first in dropdown)
  const reversedOptions = Array.from(selectElements)
    // Use flatMap to both transform and flatten the array.
    .flatMap((select) =>
      [...(select.children as HTMLCollectionOf<HTMLOptionElement>)].reverse()
    );

  // 2. Filter out invalid options and map to intermediate structure
  const validChapters = reversedOptions
    .map((option) => ({
      value: option.getAttribute("data-redirect") ?? option.value,
      text: option.innerText?.trim() ?? "", // Trim whitespace
      selected: option.selected,
    }))
    .filter((chapter) => chapter.value && chapter.text && chapter.value !== ""); // Ensure value and text exist

  // 3. Map to the final structure, adding the index-based 'id'
  const chapterListData = validChapters.map((chapter, index) => ({
    ...chapter,
    id: index, // ID is the index in the *final, filtered, reversed* list
  }));

  if (chapterListData.length === 0) {
    console.warn("No valid chapters found in the dropdown after filtering.");
  } else {
    console.log(`Extracted ${chapterListData.length} chapters.`);
  }

  return chapterListData;
}

/**
 * Determines the index of the currently selected chapter in the processed list.
 * @param chapterList The processed list of chapters.
 * @returns The index (ID) of the selected chapter, or 0 if none found.
 */
function findSelectedChapterIndex(chapterList: ChapterInfo[]): number {
  const selectedIndex = chapterList.findIndex((chapter) => chapter.selected);
  // Return the found index, or default to 0 if none is marked as selected
  // (assuming the first chapter in the list should be the default)
  return selectedIndex !== -1 ? selectedIndex : 0;
}

/**
 * Extracts the base URL for the novel/manga.
 * Tries a specific selector first, then falls back to parsing the current URL.
 */
function extractNovelUrl(): string {
  const breadcrumbLink = document.querySelector<HTMLAnchorElement>(
    "#manga-reading-nav-head .c-breadcrumb ol li:nth-child(2) a" // Simplified selector
  );

  if (breadcrumbLink?.href) {
    return breadcrumbLink.href;
  }

  // Fallback: Extract from current URL (e.g., "https://site.com/manga/novel-slug/chapter-1" -> "https://site.com/manga/novel-slug")
  // This fallback might need adjustment based on the exact URL structure
  console.warn(
    "Could not find novel URL in breadcrumbs, attempting URL parsing fallback."
  );
  const url = new URL(window.location.href);
  const pathSegments = url.pathname.split("/").filter(Boolean); // Filter empty segments
  if (pathSegments.length >= 2) {
    // Assuming structure is /type/novel-slug/...
    return `${url.origin}/${pathSegments[0]}/${pathSegments[1]}`;
  }
  // Ultimate fallback if parsing fails
  console.error("Could not determine novel URL.");
  return url.origin; // Just return the base site URL
}

/**
 * Extracts data for the chapter currently loaded on the page.
 */
function extractInitialChapterData(): InitialChapterData {
  const bookmarkButton = document.querySelector<HTMLAnchorElement>(
    'a.wp-manga-action-button[data-action="bookmark"]'
  );
  const chapterIdStr = bookmarkButton?.getAttribute("data-chapter");
  const chapterId = chapterIdStr
    ? Number(chapterIdStr)
    : Number(
        document
          .querySelector<HTMLAnchorElement>("#wp-manga-current-chap")
          ?.getAttribute("data-id")
      ); // Parse ID, handle missing attribute

  const title =
    document.querySelector("#chapter-heading")?.textContent?.trim() ??
    "Chapter Title Missing";
  const content =
    document.querySelector(".text-right")?.innerHTML ?? // Adjusted selector based on common Madara themes, verify this!
    document.querySelector(".reading-content .entry-content")?.innerHTML ?? // Another common selector
    document.querySelector(".text-left")?.innerHTML ?? // Original fallback selector
    "<p>Error: Chapter content not found.</p>"; // Default if content missing

  if (chapterId === null) {
    console.warn("Could not extract chapter ID from bookmark button.");
  }
  if (content.includes("Error: Chapter content not found.")) {
    console.warn("Could not extract chapter content from expected selectors.");
  }

  return {
    id: chapterId,
    uri: window.location.href, // Current page URI
    title: title,
    content: content,
  };
}

/**
 * Sets up and renders the SolidJS Chapter Reader component.
 */
function initializeChapterReader(): void {
  const body = document.body;
  const enabled = localStorage.getItem("chapterReaderEnabled") === "true";
  if (!body.classList.contains("reading-manga") || !enabled) {
    console.log("Chapter reader disabled or not on reading page.");
    render(
      () => (
        <div>
          <Button
            onclick={() => {
              localStorage.setItem("chapterReaderEnabled", "true");
              initializeChapterReader();
            }}
          >
            <span>تفعيل وضع القارئ</span>
          </Button>
        </div>
      ),
      (() => {
        const container = document.createElement("div");
        document.getElementById("reader-settings")?.appendChild(container);
        return container;
      })()
    );
    return; // Bail out if disabled
  }

  console.log("Manga reading page detected. Initializing SolidJS reader...");

  // 1. Cleanup existing elements
  cleanupHeadScriptsAndStyles();

  // 2. Extract necessary data from the DOM
  const chapterList = extractChapterList();
  const selectedChapterIndex = findSelectedChapterIndex(chapterList);
  const novelUrl = extractNovelUrl();
  const initialChapterData = extractInitialChapterData();

  // Basic validation before rendering
  if (chapterList.length === 0) {
    console.error("Cannot initialize reader: No chapters found.");
    // Optionally display an error message to the user on the page
    body.innerHTML = `<div style="color: red; padding: 20px;">Error: Could not load chapter list.</div>`;
    return;
  }
  if (
    initialChapterData.content.includes("Error: Chapter content not found.")
  ) {
    console.error("Cannot initialize reader: Initial chapter content missing.");
    // Optionally display an error message
    body.innerHTML = `<div style="color: red; padding: 20px;">Error: Could not load initial chapter content.</div>`;
    return; // Don't proceed if essential data is missing
  }

  // 3. Prepare the body for the SolidJS app
  body.innerHTML = ""; // Clear existing content
  // Set base classes needed for the reader's styling context (e.g., dark mode)
  body.className = "chapter-reader-active dark"; // Use a more specific class, add theme class if needed

  // 4. Render the SolidJS component
  const rootElement = document.createElement("div");
  rootElement.id = "solid-reader-root"; // Give the root an ID
  body.appendChild(rootElement);

  try {
    render(
      () => (
        <ChapterReader
          // Renamed props for clarity
          availableChapters={chapterList} // Pass the full list
          initialChapterIndex={selectedChapterIndex} // Pass the index of the current one
          novelUrl={novelUrl}
          initialChapterData={initialChapterData} // Pass the already loaded chapter data
        />
      ),
      rootElement // Render into the new root element
    );
    console.log("SolidJS Chapter Reader rendered successfully.");
  } catch (error) {
    console.error("Failed to render SolidJS Chapter Reader:", error);
    // Provide fallback feedback
    body.innerHTML = `<div style="color: red; padding: 20px;">Error: Failed to initialize the reader application. Check the console for details.</div>`;
  }
}

// --- Run Initialization ---
// Use DOMContentLoaded to ensure the initial DOM is ready before querying
// Although the original script might run later via an extension, this is safer practice.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeChapterReader);
} else {
  // DOMContentLoaded has already fired
  initializeChapterReader();
}

// The original IIFE is fine, but DOMContentLoaded is generally preferred for scripts
// that manipulate the DOM based on its initial state.
// (async function () {
//   initializeChapterReader();
// })();
