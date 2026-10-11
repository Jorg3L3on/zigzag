export const TEXT_SIZE_STORAGE_KEY = 'zigzag:text-size';
export const TEXT_SIZE_ATTRIBUTE = 'data-text-size';

export type TextSize = 'normal' | 'large';

export const readTextSize = (): TextSize => {
  try {
    return window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY) === 'large'
      ? 'large'
      : 'normal';
  } catch {
    return 'normal';
  }
};

/** Sets the root attribute that globals.css turns into an 18px root font. */
export const applyTextSize = (size: TextSize) => {
  const root = document.documentElement;
  if (size === 'large') {
    root.setAttribute(TEXT_SIZE_ATTRIBUTE, 'large');
  } else {
    root.removeAttribute(TEXT_SIZE_ATTRIBUTE);
  }
};

export const saveTextSize = (size: TextSize) => {
  try {
    if (size === 'large') {
      window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'large');
    } else {
      window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
    }
  } catch {
    // Private mode or blocked storage: the choice lasts until reload.
  }
};

/** Inline script run before first paint so the page never flashes small. */
export const TEXT_SIZE_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  TEXT_SIZE_STORAGE_KEY,
)})==='large'){document.documentElement.setAttribute(${JSON.stringify(
  TEXT_SIZE_ATTRIBUTE,
)},'large')}}catch(e){}`;
