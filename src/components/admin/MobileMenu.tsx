"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/admin/icons";

/** The sidebar, as a drawer on screens too narrow to show it. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const onClose = () => buttonRef.current?.focus();
    dialog?.addEventListener("close", onClose);
    // Wider screens show the sidebar: don't leave the drawer open behind it.
    const wide = window.matchMedia("(min-width: 64rem)");
    const onWide = () => {
      if (wide.matches) dialog?.close();
    };
    wide.addEventListener("change", onWide);
    return () => {
      dialog?.removeEventListener("close", onClose);
      wide.removeEventListener("change", onWide);
    };
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="-ml-2 inline-grid size-10 place-items-center rounded-md text-ink hover:bg-fill lg:hidden"
      >
        <MenuIcon size={20} />
        <span className="sr-only">Menu</span>
      </button>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop clicks; Escape and the close button cover the keyboard */}
      <dialog
        ref={dialogRef}
        aria-label="Admin menu"
        onClick={(event) => {
          // A press on the backdrop, or on a link (the page is changing), closes the drawer.
          const target = event.target as HTMLElement;
          if (target === event.currentTarget || target.closest("a")) dialogRef.current?.close();
        }}
        className="m-0 h-dvh max-h-none w-[min(18rem,85vw)] border-r border-hairline bg-[#edf5f9] p-0 text-ink backdrop:bg-black/30"
      >
        <div className="flex h-full flex-col">
          <div className="flex justify-end px-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-grid size-10 place-items-center rounded-md hover:bg-black/5"
            >
              <CloseIcon size={20} />
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
