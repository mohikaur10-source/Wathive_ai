import React, { useState, useMemo } from 'react';
import {
  X,
  Tag,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Calendar,
  CreditCard,
  Search,
  Filter,
  Info,
  Building,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StudentDiscount } from '../../types';

interface StudentDiscountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentDiscountsModal: React.FC<StudentDiscountsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { studentDiscounts } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [proofFilter, setProofFilter] = useState<'all' | 'watcard_physical' | 'wusa_perk_portal'>('all');

  const categories = ['all', 'Food & Dining', 'Transit & Travel', 'Tech & Supplies', 'Fitness & Leisure'];

  const filteredDiscounts = useMemo(() => {
    return studentDiscounts.filter((d) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          d.businessName.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Category
      if (selectedCategory !== 'all' && d.category !== selectedCategory) {
        return false;
      }

      // Proof filter
      if (proofFilter !== 'all' && d.verificationProof !== proofFilter) {
        return false;
      }

      return true;
    });
  }, [studentDiscounts, searchQuery, selectedCategory, proofFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950 text-white relative border-b border-stone-800">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-stone-950 flex items-center gap-1 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified UW Student Perks
            </span>
            <span className="text-xs text-stone-300 font-medium">
              WatCard Partner Directory
            </span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white">
            Waterloo Student Deals & Discounts
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-xl">
            Only confirmed official partnerships with verified redemption criteria. We never display estimated, crowd-guessed, or unverified claims.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search discounts by merchant, keyword, or campus building..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-stone-950 text-amber-300 shadow-xs'
                    : 'bg-white text-stone-600 hover:bg-stone-200/70 border border-stone-200'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}

            <div className="ml-auto hidden sm:flex items-center gap-1 text-[11px] font-bold text-stone-500">
              <CreditCard className="w-3.5 h-3.5 text-amber-600" />
              <span>WatCard Physical ID Required</span>
            </div>
          </div>
        </div>

        {/* Discounts List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {filteredDiscounts.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Tag className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-sm font-bold text-stone-700">No verified student discounts match your query.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-xs font-bold text-amber-700 underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredDiscounts.map((discount) => (
              <div
                key={discount.id}
                className="p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl hover:border-amber-400 transition-all shadow-2xs hover:shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300">
                        {discount.category}
                      </span>
                      {discount.isConfirmedPartner && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-950 text-amber-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-amber-400 stroke-[3]" />
                          Confirmed Official Partner
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-stone-950">
                      {discount.businessName}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded-xl bg-amber-400 text-stone-950 font-black text-xs sm:text-sm shadow-xs">
                      {discount.discountValue}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-bold text-stone-800">
                    {discount.title}
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {discount.description}
                  </p>
                </div>

                {/* Metadata & Requirements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-stone-600 border-t border-stone-100">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="truncate">{discount.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-medium text-stone-800">
                      Proof: {discount.verificationProof === 'watcard_physical' ? 'Physical WatCard Tap/Scan' : 'WUSA Perks Portal'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>Valid until: {discount.validUntil}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{discount.verifiedAt}</span>
                  </div>
                </div>

                {/* Terms Notice */}
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-[11px] text-stone-500">
                  <strong className="text-stone-700">Redemption Terms: </strong>
                  {discount.terms}
                </div>

                {discount.sourceUrl && (
                  <div className="pt-1 flex justify-end">
                    <a
                      href={discount.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 underline"
                    >
                      <span>View Official Partner Information</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 text-xs text-stone-600 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Waterloo Student Perks are verified weekly by WUSA Commercial Services.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-950 text-amber-300 font-bold text-xs hover:bg-stone-800"
          >
            Close Directory
          </button>
        </div>

      </div>
    </div>
  );
};
