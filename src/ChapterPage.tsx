import { IoClose, IoCog, IoMoon, IoSunny } from "solid-icons/io";
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
import { Toggle } from "./components/ui/toggle";
import { fetchChapter } from "./lib/fetch";
import { URLManager } from "./lib/URLManager";
import { debounce } from "./lib/utils";

// Types
interface Chapter {
  id: number;
  value: string;
  text: string;
  selected: boolean;
}

interface ReaderProps {
  availableChapters: Chapter[];
  novelUrl: string;
  initialChapterIndex: number;
  initialChapterData: ChapterData;
}

interface ChapterData {
  id: number;
  uri: string;
  title: string;
  content: string;
}

interface UserStyle {
  fontSize: number[];
  lineHeight: number[];
  fontFamily: string;
  backgroundColor: keyof typeof BACKGROUND_COLORS;
  theme: string;
}

// Constants
const BACKGROUND_COLORS = {
  white: "bg-white text-black",
  sepia: "bg-amber-50 text-stone-800",
  dark: "bg-gray-900 text-gray-100",
};

const SCROLL_TRIGGER_PERCENTAGE = 60;
const SCROLL_DEBOUNCE_MS = 100;
const DEFAULT_USER_STYLE: UserStyle = {
  fontSize: [16],
  lineHeight: [1.7],
  fontFamily: "serif",
  backgroundColor: "white",
  theme: "light",
};

// Components
const ChapterReader = (props: ReaderProps) => {
  // State management
  const [userStyle, setUserStyle] = createSignal<UserStyle>({
    ...DEFAULT_USER_STYLE,
  });
  const [showSettings, setShowSettings] = createSignal(false);
  const [nextChapterIndex, setNextChapterIndex] = createSignal(
    props.initialChapterIndex + 1
  );
  const [chapters, setChapters] = createSignal<ChapterData[]>([
    props.initialChapterData,
  ]);
  const [lastChapter, setLastChapter] = createSignal(false);
  const [fetching, setFetching] = createSignal(false);
  const [scrollAnchorInfo, setScrollAnchorInfo] = createSignal<{
    id: number;
    offset: number;
  } | null>(null);

  let currentChapterRef: HTMLDivElement | undefined;

  // User style getters for convenience
  const fontSize = () => userStyle().fontSize;
  const lineHeight = () => userStyle().lineHeight;
  const fontFamily = () => userStyle().fontFamily;
  const bgColor = () => userStyle().backgroundColor;
  const theme = () => userStyle().theme;

  // User style setters that update the entire style object
  const updateUserStyle = <K extends keyof UserStyle>(
    key: K,
    value: UserStyle[K]
  ) => {
    setUserStyle((prev) => ({ ...prev, [key]: value }));
  };

  // Load user preferences on mount
  const loadUserPreferences = () => {
    const colorSchema = document.body.getAttribute("data-schema");
    document.body.classList.add("dark");
    if (colorSchema === "dark") {
      updateUserStyle("backgroundColor", "dark");
      updateUserStyle("theme", "dark");
    } else {
      updateUserStyle("theme", "light");
    }

    try {
      const savedStyle = JSON.parse(localStorage.getItem("userStyle") || "{}");
      if (Object.keys(savedStyle).length) {
        setUserStyle((prevStyle: any) => ({
          ...prevStyle,
          ...savedStyle,
        }));
      }
    } catch (e) {
      console.error("Failed to load user preferences:", e);
    }
  };

  // Save user preferences when they change
  const saveUserPreferences = () => {
    try {
      localStorage.setItem("userStyle", JSON.stringify(userStyle()));
    } catch (e) {
      console.error("Failed to save user preferences:", e);
    }
  };

  // Calculate how far down the user has scrolled through the current chapter
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

    return elementHeight === 0
      ? 0
      : Math.min(100, (scrolledPastHeight / elementHeight) * 100);
  };

  // Handle scroll events
  const handleScroll = debounce(() => {
    if (lastChapter() || fetching()) return;

    const scrollPercentage = calculateScrollPercentage();
    if (scrollPercentage > SCROLL_TRIGGER_PERCENTAGE) {
      loadNextChapter();
    }
  }, SCROLL_DEBOUNCE_MS);

  // Fetch and load the next chapter
  const loadNextChapter = async () => {
    if (fetching() || lastChapter()) return;
    if (
      nextChapterIndex() === props.availableChapters.length ||
      nextChapterIndex() > props.availableChapters.length ||
      nextChapterIndex() < 0
    ) {
      setLastChapter(true);
      return;
    }
    setFetching(true);
    const chapterToFetch = props.availableChapters[nextChapterIndex()];

    try {
      const newChapter = await fetchChapter({
        url: chapterToFetch.value,
        title: chapterToFetch.text,
      });

      if (newChapter) {
        updateChapters(newChapter);
        setNextChapterIndex(nextChapterIndex() + 1);
      } else {
        setLastChapter(true);
        setScrollAnchorInfo(null);
      }
    } catch (error) {
      console.error("Failed to fetch next chapter:", error);
    } finally {
      setFetching(false);
    }
  };

  // Update chapters and handle scroll preservation
  const updateChapters = (newChapter: ChapterData) => {
    setChapters((prevChapters) => {
      if (prevChapters.length >= 3) {
        // If removing the first chapter, anchor to the second chapter
        const anchorChapter = prevChapters[1];
        const anchorElement = document.getElementById(
          `chapter-${anchorChapter.id}`
        );

        if (anchorElement) {
          const scrollOffset = window.scrollY - anchorElement.offsetTop;
          setScrollAnchorInfo({
            id: anchorChapter.id,
            offset: scrollOffset,
          });
        } else {
          console.warn(
            "Could not find anchor element for scroll preservation."
          );
          setScrollAnchorInfo(null);
        }

        // Remove first chapter, add the new one
        return [...prevChapters.slice(1), newChapter];
      } else {
        // Not removing chapters yet, just append
        setScrollAnchorInfo(null);
        return [...prevChapters, newChapter];
      }
    });
  };

  // Restore scroll position after chapters update
  const restoreScrollPosition = () => {
    const anchorInfo = scrollAnchorInfo();
    if (!anchorInfo) return;

    queueMicrotask(() => {
      const anchorElement = document.getElementById(`chapter-${anchorInfo.id}`);
      if (anchorElement) {
        const newScrollY = anchorElement.offsetTop + anchorInfo.offset;
        window.scrollTo({ top: newScrollY, behavior: "instant" });
      } else {
        console.warn(
          `Scroll anchor element chapter-${anchorInfo.id} not found.`
        );
      }
      setScrollAnchorInfo(null);
    });
  };

  // Setup effects and event handlers
  onMount(() => {
    loadUserPreferences();
    window.addEventListener("scroll", handleScroll);
    new URLManager();

    onCleanup(() => window.removeEventListener("scroll", handleScroll));
  });

  // Handle effect for user preferences
  createEffect(() => {
    saveUserPreferences();
  });

  // Effect to restore scroll position
  createEffect(on(chapters, restoreScrollPosition, { defer: true }));

  // Render the Reader UI
  return (
    <div class={"min-h-screen flex flex-col " + theme()}>
      {/* Header */}
      <ReaderHeader
        title={chapters()[0].title}
        onSettingsClick={() => setShowSettings(true)}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettings()}
        onOpenChange={setShowSettings}
        userStyle={userStyle()}
        onStyleChange={updateUserStyle}
      />

      {/* Main Content */}
      <main
        style={{
          "--line-height": `${lineHeight()[0]}`,
          "--fontSize": `${fontSize()[0]}px`,
        }}
        class={`${fontFamily()}`}
      >
        <For each={chapters()}>
          {(chapter) => (
            <ChapterCard
              chapter={chapter}
              backgroundColor={BACKGROUND_COLORS[bgColor()]}
              theme={theme()}
              ref={currentChapterRef}
            />
          )}
        </For>
      </main>

      <footer class="sticky bottom-0 p-4 backdrop-blur-sm bg-opacity-80 flex justify-end"></footer>
    </div>
  );
};

// Header Component
const ReaderHeader = (props: {
  title: string;
  onSettingsClick: () => void;
}) => (
  <header class="sticky top-0 z-10 border-b p-4 backdrop-blur-sm bg-opacity-80 flex justify-between items-center gap-2">
    <Button size="icon" aria-label="Settings" onclick={props.onSettingsClick}>
      <IoCog />
      <span class="sr-only">Settings</span>
    </Button>

    <div>
      <h1>{props.title}</h1>
    </div>
    <div>
      <Button
        size="icon"
        aria-label="Close"
        onclick={() => {
          localStorage.setItem("chapterReaderEnabled", "false");
          location.reload();
        }}
      >
        <IoClose />
        <span class="sr-only">Close</span>
      </Button>
    </div>
  </header>
);

// Settings Dialog Component
const SettingsDialog = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userStyle: UserStyle;
  onStyleChange: <K extends keyof UserStyle>(
    key: K,
    value: UserStyle[K]
  ) => void;
}) => (
  <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>اعدادات المستخدم</DialogTitle>
        <div class="flex items-center gap-4 flex-col sm:fex-row my-4">
          {/* Font Size Setting */}
          <SettingSlider
            label="حجم الخط"
            value={props.userStyle.fontSize}
            suffix="px"
            min={12}
            max={50}
            onChange={(value) => props.onStyleChange("fontSize", value)}
          />

          {/* Font Family Setting */}
          <div class="flex flex-col gap-1 w-full">
            <span>
              <span>الخط </span>
              <span class="text-xs text-gray-500">
                {props.userStyle.fontFamily}
              </span>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger as={Button<"button">}>
                {props.userStyle.fontFamily}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuGroupLabel>الخط</DropdownMenuGroupLabel>
                  <DropdownMenuRadioGroup
                    value={props.userStyle.fontFamily}
                    onChange={(value) =>
                      props.onStyleChange("fontFamily", value)
                    }
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

          {/* Line Height Setting */}
          <SettingSlider
            label="ارتفاع السطر"
            value={props.userStyle.lineHeight}
            min={1}
            max={5}
            step={0.1}
            onChange={(value) => props.onStyleChange("lineHeight", value)}
          />

          {/* Background Color Setting */}
          <div class="flex flex-col gap-1 w-full">
            <span>الخلفية</span>
            <DropdownMenu>
              <DropdownMenuTrigger as={Button<"button">}>
                {props.userStyle.backgroundColor}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuGroupLabel>الخلفية</DropdownMenuGroupLabel>
                  <DropdownMenuRadioGroup
                    value={props.userStyle.backgroundColor}
                    onChange={(value) =>
                      props.onStyleChange(
                        "backgroundColor",
                        value as keyof typeof BACKGROUND_COLORS
                      )
                    }
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
          <div class="flex flex-col gap-1 w-full">
            <span>الثيم</span>
            <div>
              <Toggle
                onclick={() =>
                  props.onStyleChange(
                    "theme",
                    props.userStyle.theme === "dark" ? "light" : "dark"
                  )
                }
                variant="outline"
              >
                {props.userStyle.theme === "dark" ? <IoMoon /> : <IoSunny />}
              </Toggle>
            </div>
          </div>
        </div>
      </DialogHeader>
    </DialogContent>
  </Dialog>
);

// Setting Slider Component
const SettingSlider = (props: {
  label: string;
  value: number[];
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number[]) => void;
}) => (
  <div class="flex flex-col gap-1 w-full">
    <span>
      <span>{props.label} </span>
      <span class="text-xs text-gray-500">
        {props.value[0]}
        {props.suffix ?? ""}
      </span>
    </span>
    <Slider
      value={props.value}
      onChange={props.onChange}
      maxValue={props.max}
      minValue={props.min}
      step={props.step}
    >
      <SliderTrack>
        <SliderFill />
        <SliderThumb />
      </SliderTrack>
    </Slider>
  </div>
);

// Chapter Card Component
const ChapterCard = (props: {
  chapter: ChapterData;
  backgroundColor: string;
  ref?: HTMLDivElement;
  theme: string;
}) => (
  <Card
    id={`chapter-${props.chapter.id}`}
    data-url={props.chapter.uri}
    class={`${props.backgroundColor} rounded-none sm:rounded sm:m-2 chapter-container`}
  >
    <CardHeader class="border-b hover:bg-accent">
      <a href={props.chapter.uri}>{props.chapter.title}</a>
    </CardHeader>
    <CardContent
      innerHTML={props.chapter.content}
      class="flex flex-col"
      style={{
        "line-height": "var(--line-height)",
        "font-size": "var(--fontSize)",
      }}
      ref={props.ref}
    />
    <CardFooter>
      <Button variant="link">
        <a href={props.chapter.uri}>
          <span class="sr-only">Open in new tab</span>
          <span>{props.chapter.title}</span>
        </a>
      </Button>
    </CardFooter>
  </Card>
);

export default ChapterReader;
