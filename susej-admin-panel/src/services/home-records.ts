import { mockCategories, mockPosts, mockProducts, mockSellers } from "./mock-data";
import type { Category, Product, Seller } from "@/types";
import type { FeaturedPostRecord } from "@/types/home-management";

// Single source of record data for the Home Management pickers.
// Today these return demo data; when the live backend is available,
// swap each function body for an API call and nothing else changes.

export function getCategories(): Category[] {
  return mockCategories;
}

export function getSellers(): Seller[] {
  return mockSellers;
}

export function getProducts(): Product[] {
  return mockProducts;
}

export function getPosts(): FeaturedPostRecord[] {
  return mockPosts;
}