'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Menu, X, Wallet, PlusCircle, ShoppingBag, CreditCard,
  Key, Heart, Ticket, Layers, Wrench, Send, Bell, User, LogOut,
  Bot, LayoutGrid, Info
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const menuItems = [
  { href: '/dashboard', icon: Bot, label: 'Telegram Bot' },
  { href: '/new-order', icon: PlusCircle, label: 'New order' },
  { href: '/services', icon: LayoutGrid, label: 'Services' },
  { href: '/orders', icon: ShoppingBag, label: 'Orders' },
  { href: '/add-balance', icon: CreditCard, label: 'Add funds' },
  { href: '/api', icon: Key, label: 'API' },
  { href: '/profile', icon: Heart, label: 'Child panel' },
  { href: '/tickets', icon: Ticket, label: 'Tickets', badge: 0 },
  { href: '/mass-order', icon: Layers, label: 'Mass order' },
  { href: '/updates', icon: Wrench, label: 'Updates' },
  { href: 'https://t.me/', icon: Send, label: 'Telegram', external: true },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
];

export function DashboardShell({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#E8F0FE] relative">
      {/* Subtle cosmic accent at top */}
      <div
        className="absolute top-0 left-0 right-0 h-48 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: "url('/images/bg-cosmic.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-blue-100 px-4 h-14 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-[#1e3a5f] hover:bg-blue-50 rounded-lg transition">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-ak.png"
              alt="AngKer SMM"
              width={28}
              height={28}
              className="object-contain logo-glow"
            />
            <div>
              <div className="font-bold text-[#1e3a5f] text-base leading-tight">
                {(user as any)?.username || user?.name || 'User'}
              </div>
              <div className="text-xs text-slate-400">Welcome to panel!</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#F0F5FF] rounded-xl px-3 py-1.5">
          <Wallet className="w-4 h-4 text-[#3B6EF5] icon-pulse" />
          <span className="font-bold text-[#1e3a5f] text-sm">
            {formatCurrency(user?.balance || 0)}
          </span>
        </div>
      </header>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="px-4 pt-4 pb-2 flex items-center gap-3">
              <Image src="/images/logo-ak.png" alt="AngKer SMM" width={36} height={36} className="object-contain logo-glow" />
              <div>
                <div className="font-bold text-sm text-[#1e3a5f]">AngKer SMM</div>
                <div className="inline-flex items-center gap-1 bg-[#3B6EF5] text-white text-xs font-bold px-2 py-0.5 rounded-md mt-0.5">
                  {formatCurrency(user?.balance || 0)}
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="ml-auto p-1">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = !item.external && (pathname === item.href || pathname.startsWith(item.href + '/'));
                const Comp = item.external ? 'a' : Link;
                const props = item.external
                  ? { href: item.href, target: '_blank', rel: 'noreferrer' }
                  : { href: item.href, onClick: () => setSidebarOpen(false) };

                return (
                  <Comp
                    key={item.label}
                    {...(props as any)}
                    className={cn(
                      'menu-item-anim flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                      active
                        ? 'bg-[#3B6EF5]/10 text-[#3B6EF5] font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <Icon className={cn('w-[18px] h-[18px] shrink-0', active && 'icon-pulse')} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-amber-400 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </Comp>
                );
              })}

              <div className="border-t border-slate-100 my-2" />

              <Link href="/profile" onClick={() => setSidebarOpen(false)} className="menu-item-anim flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                <User className="w-[18px] h-[18px]" />
                Account
              </Link>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="menu-item-anim flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                <LogOut className="w-[18px] h-[18px]" />
                Logout
              </button>
            </nav>

            <div className="p-4 border-t border-slate-100">
              <p className="text-center text-xs text-slate-400 mb-2 flex items-center justify-center gap-1">
                <Wallet className="w-3 h-3" />
                បញ្ចូលទឹកប្រាក់
              </p>
              <Link
                href="/add-balance"
                onClick={() => setSidebarOpen(false)}
                className="block w-full text-center py-3 rounded-xl bg-[#3B6EF5] text-white font-medium text-sm shadow-sm hover:bg-[#2B5CE0] transition"
              >
                Add Funds
              </Link>
            </div>
          </aside>
        </div>
      )}

      <main className="px-4 py-4 pb-24 max-w-lg mx-auto relative">
        {children}
      </main>

      <a href="https://t.me/" target="_blank" rel="noreferrer" className="float-telegram">
        <Send className="w-5 h-5 text-white" />
      </a>
    </div>
  );
}
