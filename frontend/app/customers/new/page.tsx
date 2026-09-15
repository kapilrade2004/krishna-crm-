'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Input, Select, Textarea, Button } from '@/components/ui';
import { useCreateCustomer } from '@/hooks/useApi';
import { MARKETPLACES } from '@/lib/utils';
import { PackagePlus, ArrowRight } from 'lucide-react';

export default function NewCustomerPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', whatsapp_number: '',
    address_line1: '', address_line2: '', city: '', state: '', pincode: '',
    source: 'direct', notes: '', whatsapp_opt_in: false,
  });

  const update = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createCustomer.mutateAsync(form as Partial<import('@/types').Customer>);
      const newId = res.data?.data?.customer?.id;
      router.push(newId ? `/customers/${newId}` : '/customers');
    } catch {
      /* error handled via toast */
    }
  };

  return (
    <AppShell>
      <Topbar title="New Customer" subtitle="Add a customer to the CRM · Customers officially onboard upon order delivery" />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Recommended Workflow Banner */}
        <div className="max-w-2xl mb-5 bg-amber-50/90 border border-amber-300/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
              <PackagePlus size={20} />
            </div>
            <div>
              <p className="font-bold text-amber-950 text-sm">Recommended: Add Customer via Order</p>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                In the CRM lifecycle, a customer is officially activated once their ordered product is delivered. Enter order details with recipient contact information to start the automated fulfillment workflow.
              </p>
            </div>
          </div>
          <Link href="/orders/new" className="shrink-0">
            <Button variant="primary" icon={<ArrowRight size={14} />} className="text-xs h-9 bg-navy hover:bg-navy/90 text-white font-bold whitespace-nowrap">
              Create via Order
            </Button>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="card-title">Direct Customer Registration (Override)</p>
              <span className="text-[11px] text-muted font-medium bg-slate-100 px-2 py-0.5 rounded">
                Manual Pre-delivery Entry
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name *" required className="col-span-2" value={form.name} onChange={(e) => update('name', e.target.value)} />
              <Input label="Phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="9876543210" />
              <Input label="WhatsApp Number" value={form.whatsapp_number} onChange={(e) => update('whatsapp_number', e.target.value)} placeholder="9876543210" />
              <Input label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="col-span-2" />
              <Select
                label="Source" value={form.source} onChange={(e) => update('source', e.target.value)}
                options={MARKETPLACES.map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))}
              />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
                  <input type="checkbox" checked={form.whatsapp_opt_in} onChange={(e) => update('whatsapp_opt_in', e.target.checked)} className="rounded border-border" />
                  WhatsApp opted-in
                </label>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="card-title mb-3">Address</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Address Line 1" className="col-span-2" value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} />
              <Input label="Address Line 2" className="col-span-2" value={form.address_line2} onChange={(e) => update('address_line2', e.target.value)} />
              <Input label="City" value={form.city} onChange={(e) => update('city', e.target.value)} />
              <Input label="State" value={form.state} onChange={(e) => update('state', e.target.value)} />
              <Input label="Pincode" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} />
            </div>
          </div>

          <div className="card">
            <p className="card-title mb-3">Notes</p>
            <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Any remarks about this customer..." />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="primary" loading={createCustomer.isPending} disabled={!form.name}>Create Customer</Button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
