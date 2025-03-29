import { IoClose, IoCog } from "solid-icons/io";
import {
  createEffect,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "./components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import {
  Slider,
  SliderFill,
  SliderThumb,
  SliderTrack,
} from "./components/ui/slider";
import { fetchChapter } from "./lib/fetch";
import { debounce } from "./lib/utils";
import { URLManager } from "./lib/URLManager";

interface chapter {
  id: number;
  value: string;
  text: string;
  selected: boolean;
}

interface readerProps {
  availableChapters: chapter[];
  novelUrl: string;
  initialChapterIndex: number;
  initialChapterData: chapterData;
}

interface BgOptions {
  white: string;
  sepia: string;
  dark: string;
}

interface chapterData {
  id: number; // ID from data attribute (might be missing)
  uri: string;
  title: string;
  content: string;
}

const backgroundColors: BgOptions = {
  white: "bg-white text-black",
  sepia: "bg-amber-50 text-stone-800",
  dark: "bg-gray-900 text-gray-100",
};

const ChapterReader = (props: readerProps) => {
  const [fontSize, setFontSize] = createSignal([16]);
  const [fontFamily, setFontFamily] = createSignal("serif");
  const [bgColor, setBgColor] = createSignal<keyof BgOptions>("white");
  const [showSettings, setShowSettings] = createSignal(false);
  const [lineHeight, setLineHeight] = createSignal([1.7]);
  const [nextChpaterIndex, setNextChpaterIndex] = createSignal(
    props.initialChapterIndex + 1
  );

  const [chapters, setChapters] = createSignal<chapterData[]>([
    props.initialChapterData,
  ]);
  const [lastChapter, setLastChapter] = createSignal(false);
  const [fetching, setFetching] = createSignal(false);
  const [scrollAnchorInfo, setScrollAnchorInfo] = createSignal<{
    id: number;
    offset: number;
  } | null>(null);

  let currentChapterRef: HTMLDivElement | undefined;
  createEffect(() => {
    const colorSchema = document.body.getAttribute("data-schema");
    if (colorSchema === "dark") {
      document.body.classList.add("dark");
      setBgColor("dark");
    } else {
      document.body.classList.remove("dark");
      setBgColor("white");
    }
    const userStyle = JSON.parse(localStorage.getItem("userStyle") ?? "{}");
    if (userStyle) {
      setFontSize(userStyle.fontSize);
      setLineHeight(userStyle.lineHeight);
      setFontFamily(userStyle.fontFamily);
      setBgColor(userStyle.backgroundColor);
    }
  });

  createEffect(() => {
    const userStyle = {
      fontSize: fontSize(),
      lineHeight: lineHeight(),
      fontFamily: fontFamily(),
      backgroundColor: bgColor(),
    };
    localStorage.setItem("userStyle", JSON.stringify(userStyle));
  }, [fontSize, lineHeight, fontFamily, bgColor]);

  const handleScroll = debounce(() => {
    if (lastChapter()) return;
    const scrollPercentage = calculateScrollPercentage();
    // Load next chapter when we're 60% through the current one

    if (scrollPercentage > 60 && !fetching()) {
      // Fetch the next chapter
      loadNextChapter();
    }
  }, 100);

  const calculateScrollPercentage = () => {
    const el = currentChapterRef;
    if (!el) return 0;

    const rect = el.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;

    // Element is above viewport (completely scrolled past)
    if (rect.top <= -rect.height) return 100;

    // Element is below viewport (not seen yet)
    if (rect.top >= windowHeight) return 0;

    // Calculate partial scroll percentage
    const scrolledPastHeight = Math.max(0, -rect.top);
    const elementHeight = rect.height;

    if (elementHeight === 0) return 0;

    return Math.min(100, (scrolledPastHeight / elementHeight) * 100);
  };

  onMount(() => {
    window.addEventListener("scroll", handleScroll);
    new URLManager(); // Initialize the URL Manager
    onCleanup(() => window.removeEventListener("scroll", handleScroll));
  });

  // Effect to restore scroll position after chapters update
  createEffect(
    on(
      chapters,
      () => {
        const anchorInfo = scrollAnchorInfo();
        if (anchorInfo) {
          // Use queueMicrotask to wait for Solid's batching & DOM update
          queueMicrotask(() => {
            const anchorElement = document.getElementById(
              `chapter-${anchorInfo.id}`
            );
            if (anchorElement) {
              const newScrollY = anchorElement.offsetTop + anchorInfo.offset;
              console.log(
                `Restoring scroll to: ${newScrollY} (Anchor ID: ${anchorInfo.id}, Top: ${anchorElement.offsetTop}, Offset: ${anchorInfo.offset})`
              );
              window.scrollTo({ top: newScrollY, behavior: "instant" }); // Use 'instant' to avoid visible jump
            } else {
              console.warn(
                `Scroll anchor element chapter-${anchorInfo.id} not found after update.`
              );
            }
            setScrollAnchorInfo(null); // Clear anchor info after restoring
          });
        }
      },
      { defer: true }
    )
  ); // defer: true ensures it runs after the initial render potentially caused by setting chapters

  const loadNextChapter = async () => {
    if (fetching() || lastChapter()) return;

    setFetching(true);
    const chapterToFetch = props.availableChapters[nextChpaterIndex()];
    const newChapter = await fetchChapter({
      url: chapterToFetch.value,
      title: chapterToFetch.text,
    });

    if (newChapter) {
      setChapters((prevChapters) => {
        // --- Scroll Preservation Logic ---
        let anchorId: number | null = null;
        let scrollOffset = 0;

        if (prevChapters.length >= 3) {
          // If removing the first chapter, anchor to the second chapter
          const anchorChapter = prevChapters[1]; // The chapter that will become the first
          anchorId = anchorChapter.id;
          const anchorElement = document.getElementById(`chapter-${anchorId}`);
          if (anchorElement) {
            scrollOffset = window.scrollY - anchorElement.offsetTop;
            console.log(
              `Setting scroll anchor: ID=${anchorId}, Offset=${scrollOffset}, ScrollY=${window.scrollY}, AnchorTop=${anchorElement.offsetTop}`
            );
            setScrollAnchorInfo({ id: anchorId, offset: scrollOffset });
          } else {
            console.warn(
              "Could not find anchor element for scroll preservation."
            );
            setScrollAnchorInfo(null); // Reset if anchor not found
          }
          // Prepare the new list: remove the first, add the new one
          return [...prevChapters.slice(1), newChapter];
        } else {
          // Not removing chapters yet, just append
          setScrollAnchorInfo(null); // No scroll adjustment needed
          return [...prevChapters, newChapter];
        }
      });
      setNextChpaterIndex(nextChpaterIndex() + 1);
    } else {
      setLastChapter(true); // No more chapters found
      setScrollAnchorInfo(null); // No scroll adjustment needed
    }

    setFetching(false);
  };

  return (
    <div class={"min-h-screen flex flex-col "}>
      {/*  Header */}
      <header class="sticky top-0 z-10 border-b p-4 backdrop-blur-sm bg-opacity-80 flex justify-between items-center gap-2">
        <Button
          size="icon"
          aria-label="Settings"
          onclick={() => setShowSettings(true)}
        >
          <IoCog />
          <span class="sr-only">Settings</span>
        </Button>

        <div>
          <h1>{chapters()[0].title}</h1>
        </div>
        <div>
          <Button size="icon" aria-label="Close">
            <IoClose />
            <span class="sr-only">Close</span>
          </Button>
        </div>
      </header>

      {/*  Settings Dialog */}
      <Dialog open={showSettings()} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>اعدادات المستخدم</DialogTitle>
            <div class="flex items-center gap-4 flex-col sm:fex-row my-4">
              <div class="flex flex-col gap-1 w-full">
                <span>
                  <span>حجم الخط </span>
                  <span class="text-xs text-gray-500"> {fontSize()[0]}px</span>
                </span>
                <Slider
                  value={fontSize()}
                  onChange={(e) => setFontSize(e)}
                  maxValue={50}
                  minValue={12}
                >
                  <SliderTrack>
                    <SliderFill />
                    <SliderThumb />
                  </SliderTrack>
                </Slider>
              </div>
              <div class="flex flex-col gap-1 w-full">
                <span>
                  <span>الخط </span>
                  <span class="text-xs text-gray-500">{fontFamily()}</span>
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger as={Button<"button">}>
                    {fontFamily()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuGroupLabel>الخط</DropdownMenuGroupLabel>
                      <DropdownMenuRadioGroup
                        value={fontFamily()}
                        onChange={setFontFamily}
                      >
                        <DropdownMenuRadioItem value="serif">
                          سيريف
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sans">
                          سانس
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="mono">
                          مونو
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div class="flex flex-col gap-1 w-full">
                <span>
                  <span>ارتفاع السطر </span>
                  <span class="text-xs text-gray-500">{lineHeight()}</span>
                </span>
                <Slider
                  value={lineHeight()}
                  onChange={(e) => setLineHeight(e)}
                  maxValue={5}
                  minValue={1}
                  step={0.1}
                >
                  <SliderTrack>
                    <SliderFill />
                    <SliderThumb />
                  </SliderTrack>
                </Slider>
              </div>

              <div class="flex flex-col gap-1 w-full">
                <span> الخلفية </span>
                <DropdownMenu>
                  <DropdownMenuTrigger as={Button<"button">}>
                    {bgColor()}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuGroupLabel>الخلفية</DropdownMenuGroupLabel>
                      <DropdownMenuRadioGroup
                        value={bgColor()}
                        onChange={setBgColor}
                      >
                        <DropdownMenuRadioItem value="white">
                          ابيض
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sepia">
                          البنية
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dark">
                          المظلم
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/*  Main Content */}
      <main
        style={{
          "--line-height": `${lineHeight()}`,
          "--fontSize": `${fontSize()}px`,
        }}
      >
        <For each={chapters()}>
          {(chapter) => (
            <Card
              id={`chapter-${chapter.id}`}
              data-url={chapter.uri}
              class={
                backgroundColors[bgColor()] +
                " rounded-none sm:rounded sm:m-2 chapter-container"
              }
            >
              <CardHeader class="border-b hover:bg-accent">
                <a href={chapter.uri}>{chapter.title}</a>
              </CardHeader>
              <CardContent
                innerHTML={chapter.content}
                class="flex flex-col "
                style={{
                  "line-height": "var(--line-height)",
                  "font-size": `var(--fontSize)`,
                }}
                ref={currentChapterRef}
              />
              <CardFooter>
                <Button variant="link">
                  <a href={chapter.uri}>
                    <span class="sr-only">Open in new tab</span>
                    <span>{chapter.title}</span>
                  </a>
                </Button>
              </CardFooter>
            </Card>
          )}
        </For>
      </main>

      <footer class="sticky bottom-0 p-4 backdrop-blur-sm bg-opacity-80 flex justify-end"></footer>
    </div>
  );
};

export default ChapterReader;
