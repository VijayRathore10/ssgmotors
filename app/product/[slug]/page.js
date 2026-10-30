import ImageCarousel from '@/components/ImageCarousel';
import InquiryForm from '@/components/InquiryForm';
import { getProductBySlug, getProducts } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}


export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.name) return notFound();

  // Filter out any blank/empty rows: empty rows will not be captured on the webpage (max 30 rows)
  const specs = (product.specifications || [])
    .filter((s) => s && ((s.label && s.label.trim().length > 0) || (s.value && s.value.trim().length > 0)))
    .slice(0, 30);
  const highlights = (product.highlights || []).filter(Boolean);

  return (
    <section className="mx-auto max-w-7xl px-5 md:px-8 pt-28 pb-16">
      <nav className="mono-label text-[11px] uppercase text-graphite mb-6">
        <Link href="/" className="hover:text-freight">Home</Link>
        {' / '}
        <Link href={`/category/${product.category?.slug}`} className="hover:text-freight">
          {product.category?.title}
        </Link>
        {' / '}
        <span className="text-steel">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-5 gap-10">
        {/* Left Column: Gallery, Description, and Contact Us / Inquiry Form */}
        <div className="lg:col-span-3">
          <ImageCarousel images={product.gallery} alt={product.name} />

          {product.description && (
            <div className="mt-8 pt-6 border-t border-line/80">
              <h2 className="mono-label text-xs uppercase text-amber-dark font-bold tracking-wider mb-3">
                Vehicle Overview
              </h2>
              <p className="text-base leading-relaxed text-steel/90">{product.description}</p>
            </div>
          )}

          {/* Contact Us Form - positioned on left side below description */}
          <div className="mt-8 pt-6 border-t border-line/80">
            <h2 className="mono-label text-xs uppercase text-amber-dark font-bold tracking-wider mb-3">
              Request Export Quotation & Inspection
            </h2>
            <InquiryForm productName={product.name} />
          </div>
        </div>

        {/* Right Column: Title, Highlights, and 30-Row Specifications Table */}
        <div className="lg:col-span-2">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3 leading-tight">
            {product.name}
          </h1>

          {highlights.length > 0 && (
            <div className="rivet-plate p-4 mb-6 flex flex-wrap gap-2 mono-label text-[11px] uppercase text-steel">
              {highlights.map((h, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 bg-white/80 border border-line rounded px-2.5 py-1 text-steel font-medium shadow-2xs whitespace-normal break-words"
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {specs.length > 0 && (
            <div className="mb-8">
              <p className="mono-label text-xs uppercase text-amber-dark mb-2">Specifications</p>
              <table className="w-full text-sm border-t border-line">
                <tbody>
                  {specs.map((s, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="py-2 pr-4 text-graphite w-2/5">{s.label}</td>
                      <td className="py-2 font-medium">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
