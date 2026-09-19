'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ServicesPage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/services');
        if (res.ok) {
          const data = await res.json();
          setServices(data.services || []);
          setCategories(data.categories || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = services;
    if (cat !== 'all') list = list.filter((s) => s.categoryId === cat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.id.includes(q)
      );
    }
    return list;
  }, [services, cat, search]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B6EF5]" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1e3a5f]">Services</h1>
        <Link href="/new-order" className="btn-primary h-9 px-3 text-xs w-auto">
          New order
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input-field pl-10"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <select className="input-field" value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="all">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="text-xs text-slate-400">{filtered.length} services</div>

      {filtered.map((s) => (
        <div key={s.id} className="panel-card p-4">
          <div className="font-semibold text-sm text-[#1e3a5f]">{s.name}</div>
          {s.description && (
            <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{s.description}</div>
          )}
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <span className="bg-blue-50 text-[#3B6EF5] px-2 py-0.5 rounded-full font-bold">
              {formatCurrency(s.price)} / 1K
            </span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {s.min} – {s.max}
            </span>
            {s.averageTime && (
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {s.averageTime}
              </span>
            )}
            {s.refill && (
              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Refill</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
