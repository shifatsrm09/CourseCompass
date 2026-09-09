import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function CourseContextMenu({ context, onClose, onRemove }) {
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(context.x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(context.y, window.innerHeight - rect.height - 8))}px`;
    menu.querySelector("button").focus({ preventScroll: true });

    const outside = (event) => {
      if (!menu.contains(event.target)) onClose();
    };
    const dismiss = () => onClose();
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        context.target.focus({ preventScroll: true });
        onClose();
      } else if (event.key === "Tab") {
        context.target.focus({ preventScroll: true });
        onClose();
      } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        menu.querySelector("button").focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("contextmenu", outside);
    document.addEventListener("keydown", keydown);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("contextmenu", outside);
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", dismiss);
    };
  }, [context, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${context.code} actions`}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-50 min-w-44 max-w-[calc(100vw-16px)] rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-xl shadow-black/50"
      style={{ left: context.x, top: context.y }}
    >
      <button
        type="button"
        role="menuitem"
        className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-100 outline-none hover:bg-neutral-800 focus:bg-neutral-800"
        onClick={() => {
          context.target.focus({ preventScroll: true });
          onClose();
          onRemove();
        }}
      >
        Remove course
      </button>
    </div>,
    document.body
  );
}
