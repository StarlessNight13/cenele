interface ChapterData {
    id: number;
    uri: string;
    title: string;
    content: string;
}


export const fetchChapter = async ({
    url,
    title
}: {
    url: string;
    title: string
}) => {
    const response = await fetch(url);
    if (response.ok) {
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const data = extractChapterData(doc, url);
        return {
            id: data.id,
            uri: data.uri,
            title: data.title,
            content: data.content,
        };
    } else if (response.status === 404) {
        console.error("Failed to fetch chapter:", title);
        return null;
    } else if (response.status === 403) {
        location.href = url // Redirect to the original URL
        console.error("Failed to fetch chapter:", title);
        return null;
    } else {
        console.error("Failed to fetch chapter:", title);
        return null;
    }
};


function extractChapterData(doc: Document, uri: string): ChapterData {
    const bookmarkButton = doc.querySelector<HTMLAnchorElement>(
        'a.wp-manga-action-button[data-action="bookmark"]'
    );
    const chapterIdStr = bookmarkButton?.getAttribute("data-chapter");
    const chapterId = chapterIdStr
        ? Number(chapterIdStr)
        : Number(
            doc
                .querySelector<HTMLAnchorElement>("#wp-manga-current-chap")
                ?.getAttribute("data-id")
        ); // Parse ID, handle missing attribute

    const title =
        doc.querySelector("#chapter-heading")?.textContent?.trim() ??
        "Chapter Title Missing";
    const content =
        doc.querySelector(".text-right")?.innerHTML ?? // Adjusted selector based on common Madara themes, verify this!
        doc.querySelector(".reading-content .entry-content")?.innerHTML ?? // Another common selector
        doc.querySelector(".text-left")?.innerHTML ?? // Original fallback selector
        "<p>Error: Chapter content not found.</p>"; // Default if content missing

    if (chapterId === null) {
        console.warn("Could not extract chapter ID from bookmark button.");
    }
    if (content.includes("Error: Chapter content not found.")) {
        console.warn("Could not extract chapter content from expected selectors.");
    }

    return {
        id: chapterId,
        uri, // Current page URI
        title: title,
        content: content,
    };
}
