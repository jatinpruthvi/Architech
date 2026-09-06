"use client";
/* Isolated so the search first-load chunk does not pay for listing-detail
   labels until the visitor opens a card. */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import Pic from "@/components/architech/Pic";
import { labelForFacing, labelForFurnishing, propertyFactRows } from "@/lib/listing-details";
import { mediaDisplayUrl } from "@/lib/media/display-url";
import type { Property } from "@/lib/repositories";

export default function SearchQuickView({
  property,
  open,
  onOpenChange,
}: {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-t-2 border-brick bg-paper text-ink sm:max-w-[520px] sm:ml-auto sm:rounded-none">
        {property && (
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="kicker text-brick">Quick view · {property.city}</p>
                <h2 className="mt-2 font-display text-2xl font-medium leading-tight tracking-[-0.02em]">{property.title}<span className="text-brick">.</span></h2>
              </div>
              <button type="button" onClick={() => onOpenChange(false)} className="touch-44 rounded-lg border border-ink/15 px-3 stamp font-semibold ink-2 hover:border-brick hover:text-brick">Close</button>
            </div>
            <div className="mt-5 overflow-hidden border border-ink/12 bg-sand">
              {/* src resolves R2 media through the edge transform; undefined in fixture mode. */}
              <Pic name={property.image} src={mediaDisplayUrl(property.imageUrl, 1040)} alt={`${property.title}, ${property.locality}`} className="aspect-[1.6] h-full w-full object-cover" sizes="520px" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-y border-ink/12 py-4 sm:grid-cols-4">
              <div><p className="stamp ink-3">Price</p><p className="mt-1 font-display text-lg font-semibold [font-variant-numeric:tabular-nums]">{property.price}</p></div>
              <div><p className="stamp ink-3">Layout</p><p className="mt-1 text-sm font-semibold">{property.meta}</p></div>
              <div><p className="stamp ink-3">Area</p><p className="mt-1 text-sm font-semibold [font-variant-numeric:tabular-nums]">{property.area}</p></div>
              <div><p className="stamp ink-3">Status</p><p className="mt-1 text-sm font-semibold text-trust">{property.status}</p></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-px border border-ink/10 bg-ink/10 sm:grid-cols-3">
              {propertyFactRows(property.details).map(([label, value]) => <div key={label} className="bg-paper p-3"><p className="stamp ink-3">{label}</p><p className="mt-1 text-sm font-semibold text-ink">{value}</p></div>)}
            </div>
            <p className="mt-5 text-sm leading-7 ink-2">{property.note}</p>
            <p className="mt-4 border-l-2 border-brick/50 pl-3 text-xs leading-5 ink-2"><span className="font-semibold text-ink">Amenities.</span> {property.details.amenities?.join(" · ") || "Not specified"} · {labelForFurnishing(property.details.furnishing)} · {labelForFacing(property.details.facing)}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href={`/listing/${property.id}`} onClick={() => onOpenChange(false)} className="night-fill btn-sweep touch-44 inline-flex flex-1 items-center justify-center bg-night px-5 py-3 stamp font-semibold text-cream">Full details <ArrowUpRight size={13} className="ml-1" /></Link>
              <Link href={`/requirements/?listing=${encodeURIComponent(property.id)}`} onClick={() => onOpenChange(false)} className="touch-44 inline-flex flex-1 items-center justify-center rounded-lg border border-ink/20 px-5 py-3 stamp font-semibold text-brick hover:border-brick">Schedule a visit</Link>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
