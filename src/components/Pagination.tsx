"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath?: string;
};

export default function Pagination({ currentPage, totalPages, basePath = "/" }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`${basePath}?${params.toString()}`);
  };

  const pages: (number | string)[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <nav className="flex items-center justify-center gap-2 mt-12">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-lg border border-border hover:bg-primary hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text"
      >
        <FiChevronLeft size={18} />
      </button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-text-light">...</span>
        ) : (
          <button
            key={page}
            onClick={() => goToPage(page as number)}
            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
              currentPage === page
                ? "bg-primary text-white"
                : "border border-border hover:bg-primary/10 hover:text-primary"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg border border-border hover:bg-primary hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text"
      >
        <FiChevronRight size={18} />
      </button>
    </nav>
  );
}
