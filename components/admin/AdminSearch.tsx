"use client";

import {
  Search,
  X,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

import { searchService } from "@/services/search.service";

import {
  SearchResult,
} from "@/types/search";

interface Props {
  open: boolean;

  onClose: () => void;
}

export default function AdminSearch({
  open,
  onClose,
}: Props) {
  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<SearchResult[]>(
      []
    );
    
  const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

  useEffect(() => {
    const load =
      async () => {
        setResults(
          await searchService.search(
            query
          )
        );
      };

    load();
  }, [query]);

  const iconMap = {
    orden:
      ShoppingCart,

    producto:
      Package,

    cliente:
      Users,
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={
              onClose
            }
          />

          <motion.div
            initial={{
              opacity: 0,
              y: -20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -20,
            }}
            className="fixed top-20 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 rounded-2xl border bg-background shadow-xl"
          >
            <div className="relative border-b p-4">

              <Search className="absolute left-7 top-1/2 w-4 h-4 -translate-y-1/2" />

              <input
                value={query}
                ref={inputRef}
                onChange={(e) =>
                  setQuery(
                    e.target.value
                  )
                }
                placeholder="Buscar órdenes, productos o clientes..."
                className="w-full bg-transparent pl-10 outline-none"
              />

              <button
                onClick={
                  onClose
                }
                className="absolute right-5 top-1/2 -translate-y-1/2"
              >
                <X />
              </button>
            </div>

            <div className="max-h-125 overflow-auto">

              {results.map(
                (
                  item
                ) => {
                  const Icon =
                    iconMap[
                      item.type
                    ];

                  return (
                    <Link
                      key={
                        item.id
                      }
                      href={
                        item.href
                      }
                      onClick={
                        onClose
                      }
                      className="flex items-center gap-4 p-4 hover:bg-muted"
                    >
                      <Icon className="w-4 h-4" />

                      <div className="flex-1">

                        <p className="font-medium">
                          {
                            item.title
                          }
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {
                            item.subtitle
                          }
                        </p>

                      </div>

                      <span className="text-xs rounded-full bg-muted px-2 py-1">
                        {
                          item.badge
                        }
                      </span>
                    </Link>
                  );
                }
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}