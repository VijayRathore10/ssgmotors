import fs from 'fs';
import path from 'path';
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');

// Memory cache to ensure instant sub-millisecond synchronous & async queries
let memoryStore = null;

function seedInitialData() {
  try {
    if (fs.existsSync(SEED_FILE)) {
      const raw = fs.readFileSync(SEED_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[DB] Error loading seed.json:', err);
  }

  return {
    categories: [],
    products: [],
    testimonials: [],
    siteSettings: {},
    inquiries: [],
  };
}

function loadStore() {
  if (memoryStore) return memoryStore;

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      memoryStore = JSON.parse(raw);
      return memoryStore;
    }
  } catch (err) {
    console.error('[DB] Error reading store.json, re-seeding:', err?.message || err);
  }

  // If file doesn't exist or is invalid, seed initial dataset
  memoryStore = seedInitialData();
  saveStore(memoryStore);
  return memoryStore;
}

function saveStore(data) {
  memoryStore = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error writing to store.json:', err?.message || err);
  }
}

// Helper to sort items basis position numbering system (1, 2, 3...)
function sortByPosition(items = []) {
  return [...items].sort((a, b) => {
    const hasA = a.order !== undefined && a.order !== null && a.order !== '';
    const hasB = b.order !== undefined && b.order !== null && b.order !== '';
    const orderA = hasA ? Number(a.order) : Infinity;
    const orderB = hasB ? Number(b.order) : Infinity;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Secondary fallback: updatedAt or createdAt descending
    const dateA = new Date(a.updatedAt || a._updatedAt || a._createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b._updatedAt || b._createdAt || 0).getTime();
    return dateB - dateA;
  });
}

// ==========================================
// PRODUCTS CRUD
// ==========================================

export async function getDbProducts() {
  const store = loadStore();
  return sortByPosition(store.products || []);
}

export async function getDbProductBySlug(slug) {
  const store = loadStore();
  return (
    store.products.find(
      (p) => p.slug?.toLowerCase() === slug?.toLowerCase() || p._id === slug
    ) || null
  );
}

export async function getDbProductsByCategory(categorySlug) {
  const store = loadStore();
  const matched = (store.products || []).filter(
    (p) => p.category?.slug?.toLowerCase() === categorySlug?.toLowerCase()
  );
  return sortByPosition(matched);
}

export async function saveDbProduct(productData) {
  const store = loadStore();
  const products = [...store.products];

  // Clean specifications: filter out completely blank rows, max 30 rows
  const cleanedSpecs = (productData.specifications || [])
    .filter((s) => s && ((s.label && s.label.trim()) || (s.value && s.value.trim())))
    .slice(0, 30)
    .map((s) => ({
      label: (s.label || '').trim(),
      value: (s.value || '').trim(),
    }));

  let productOrder = null;
  if (
    productData.order !== undefined &&
    productData.order !== null &&
    productData.order !== ''
  ) {
    const parsed = Number(productData.order);
    if (!Number.isNaN(parsed)) {
      productOrder = parsed;
    }
  }

  const product = {
    ...productData,
    order: productOrder,
    specifications: cleanedSpecs,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = products.findIndex(
    (p) => (product._id && p._id === product._id) || (product.slug && p.slug === product.slug)
  );

  if (existingIndex >= 0) {
    products[existingIndex] = {
      ...products[existingIndex],
      ...product,
    };
  } else {
    product._id = product._id || `prod-${Date.now()}`;
    if (!product.slug) {
      product.slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    products.unshift(product);
  }

  saveStore({ ...store, products });
  return product;
}

export async function deleteDbProduct(id) {
  const store = loadStore();
  const products = store.products.filter((p) => p._id !== id && p.slug !== id);
  saveStore({ ...store, products });
  return true;
}

// ==========================================
// CATEGORIES CRUD
// ==========================================

export async function getDbCategories() {
  const store = loadStore();
  return store.categories || [];
}

export async function getDbCategoryBySlug(slug) {
  const store = loadStore();
  return (
    store.categories.find(
      (c) => c.slug?.toLowerCase() === slug?.toLowerCase() || c._id === slug
    ) || null
  );
}

export async function saveDbCategory(categoryData) {
  const store = loadStore();
  const categories = [...store.categories];

  const category = {
    ...categoryData,
    _id: categoryData._id || `cat-${Date.now()}`,
    slug: categoryData.slug || categoryData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  };

  const idx = categories.findIndex((c) => c._id === category._id || c.slug === category.slug);
  if (idx >= 0) {
    categories[idx] = { ...categories[idx], ...category };
  } else {
    categories.push(category);
  }

  saveStore({ ...store, categories });
  return category;
}

export async function deleteDbCategory(id) {
  const store = loadStore();
  const categories = store.categories.filter((c) => c._id !== id && c.slug !== id);
  saveStore({ ...store, categories });
  return true;
}

// ==========================================
// TESTIMONIALS CRUD
// ==========================================

export async function getDbTestimonials() {
  const store = loadStore();
  return sortByPosition(store.testimonials || []);
}

export async function saveDbTestimonial(testimonialData) {
  const store = loadStore();
  const testimonials = [...store.testimonials];

  let testiOrder = null;
  if (
    testimonialData.order !== undefined &&
    testimonialData.order !== null &&
    testimonialData.order !== ''
  ) {
    const parsed = Number(testimonialData.order);
    if (!Number.isNaN(parsed)) {
      testiOrder = parsed;
    }
  }

  const testimonial = {
    ...testimonialData,
    order: testiOrder,
    _id: testimonialData._id || `testi-${Date.now()}`,
    photos: (testimonialData.photos || []).slice(0, 4),
  };

  const idx = testimonials.findIndex((t) => t._id === testimonial._id);
  if (idx >= 0) {
    testimonials[idx] = { ...testimonials[idx], ...testimonial };
  } else {
    testimonials.push(testimonial);
  }

  saveStore({ ...store, testimonials });
  return testimonial;
}

export async function deleteDbTestimonial(id) {
  const store = loadStore();
  const testimonials = store.testimonials.filter((t) => t._id !== id);
  saveStore({ ...store, testimonials });
  return true;
}

// ==========================================
// SITE SETTINGS CRUD
// ==========================================

export async function getDbSiteSettings() {
  const store = loadStore();
  return store.siteSettings || {};
}

export async function saveDbSiteSettings(settingsData) {
  const store = loadStore();
  const siteSettings = {
    ...store.siteSettings,
    ...settingsData,
  };
  saveStore({ ...store, siteSettings });
  return siteSettings;
}

// ==========================================
// INQUIRIES / LEADS
// ==========================================

export async function getDbInquiries() {
  const store = loadStore();
  return store.inquiries || [];
}

export async function addDbInquiry(inquiryData) {
  const store = loadStore();
  const inquiries = [...(store.inquiries || [])];

  const inquiry = {
    ...inquiryData,
    _id: `inq-${Date.now()}`,
    submittedAt: new Date().toISOString(),
  };

  inquiries.unshift(inquiry);
  saveStore({ ...store, inquiries });
  return inquiry;
}

export async function deleteDbInquiry(id) {
  const store = loadStore();
  const inquiries = (store.inquiries || []).filter((inq) => inq._id !== id);
  saveStore({ ...store, inquiries });
  return true;
}

// ==========================================
// BACKUP / RESTORE
// ==========================================

export function getRawDatabase() {
  return loadStore();
}

export function restoreDatabase(fullJson) {
  if (!fullJson || typeof fullJson !== 'object') {
    throw new Error('Invalid database format');
  }
  saveStore(fullJson);
  return true;
}
