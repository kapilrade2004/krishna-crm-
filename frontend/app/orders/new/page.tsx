'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Input, Select, Textarea, Button } from '@/components/ui';
import { useCreateOrder, useCustomers, useUsers } from '@/hooks/useApi';
import { MARKETPLACES } from '@/lib/utils';
import { Search, MessageCircle, ShieldCheck, UserPlus, MapPin, Package } from 'lucide-react';
import type { Customer } from '@/types';

const SUB_CHANNELS_BY_MARKETPLACE: Record<string, { value: string; label: string }[]> = {
  amazon: [
    { value: 'amazon_channel_1', label: 'Amazon · Channel 1 (Primary)' },
    { value: 'amazon_channel_2', label: 'Amazon · Channel 2 (Secondary)' },
    { value: 'amazon_channel_3', label: 'Amazon · Channel 3 (Tertiary)' },
  ],
  flipkart: [
    { value: 'flipkart', label: 'Flipkart · Seller Hub' },
  ],
  indiamart: [
    { value: 'indiamart', label: 'IndiaMART · B2B Portal' },
  ],
  akuabeat_website: [
    { value: 'akuabeat_website', label: 'Akuabeat · Official Store' },
  ],
  direct: [
    { value: 'direct', label: 'Direct · Offline / Phone Orders' },
  ],
  website: [
    { value: 'website', label: 'Website General Store' },
  ],
  other: [
    { value: 'other', label: 'Other Channel' },
  ],
};

export default function NewOrderPage() {
  const router = useRouter();
  const createOrder = useCreateOrder();

  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
  });

  const { data: customerData } = useCustomers({ q: customerSearch, limit: 8 });
  const { data: users = [] } = useUsers();
  const customerResults: Customer[] = customerSearch.length >= 2 ? (customerData?.data || []) : [];

  const [form, setForm] = useState({
    marketplace: 'direct',
    channel: 'direct',
    sub_channel: 'direct',
    marketplace_order_id: '',
    product_name: 'AquaBeat Water Purifier Premier',
    product_sku: 'AKU-WTR-PREM-01',
    quantity: 1,
    unit_price: '2499',
    total_amount: '2499',
    delivery_pincode: '',
    assigned_to: '',
    order_date: new Date().toISOString().split('T')[0],
    internal_notes: '',
  });

  const update = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleMarketplaceChange = (m: string) => {
    const subs = SUB_CHANNELS_BY_MARKETPLACE[m] || [];
    const defaultSub = subs.length > 0 ? subs[0].value : m;
    setForm((f) => ({
      ...f,
      marketplace: m,
      channel: defaultSub,
      sub_channel: defaultSub,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      ...form,
      channel: form.sub_channel || form.channel || form.marketplace,
      quantity: Number(form.quantity) || 1,
      unit_price: form.unit_price ? Number(form.unit_price) : undefined,
      total_amount: form.total_amount ? Number(form.total_amount) : undefined,
    };

    if (customerMode === 'existing') {
      if (!selectedCustomer) return;
      payload.customer_id = selectedCustomer.id;
      payload.customer_name = selectedCustomer.name;
      payload.customer_phone = selectedCustomer.phone;
      payload.customer_email = selectedCustomer.email || undefined;
      if (selectedCustomer.pincode && !payload.delivery_pincode) {
        payload.delivery_pincode = selectedCustomer.pincode;
      }
      payload.shipping_address = {
        ship_name: selectedCustomer.name,
        ship_phone: selectedCustomer.phone,
        address_line1: selectedCustomer.address_line1,
        address_line2: selectedCustomer.address_line2,
        city: selectedCustomer.city,
        state: selectedCustomer.state,
        pincode: selectedCustomer.pincode,
      };
    } else {
      if (!newCustomer.phone) return;
      payload.customer_name = newCustomer.name || 'Valued Customer';
      payload.customer_phone = newCustomer.phone;
      payload.customer_email = newCustomer.email || undefined;
      const shipPincode = newCustomer.pincode || form.delivery_pincode;
      if (shipPincode && !payload.delivery_pincode) {
        payload.delivery_pincode = shipPincode;
      }
      payload.shipping_address = {
        ship_name: newCustomer.name || 'Valued Customer',
        ship_phone: newCustomer.phone,
        address_line1: newCustomer.address_line1,
        address_line2: newCustomer.address_line2,
        city: newCustomer.city,
        state: newCustomer.state,
        pincode: shipPincode,
      };
    }

    try {
      const res = await createOrder.mutateAsync(payload);
      const newId = res.data?.data?.order?.id;
      router.push(newId ? `/orders/${newId}` : '/orders');
    } catch {
      /* error toast handled in hook */
    }
  };

  const isSubmitDisabled =
    customerMode === 'existing' ? !selectedCustomer : !newCustomer.phone;

  const currentSubChannels = SUB_CHANNELS_BY_MARKETPLACE[form.marketplace] || [
    { value: form.marketplace, label: form.marketplace },
  ];

  return (
    <AppShell>
      <Topbar title="New Order" subtitle="Create an order entry · Recipient will be registered as a Customer once delivered" />
      <main className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          
          {/* WhatsApp Verification Notice Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <MessageCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                <span>Instant WhatsApp Verification Enabled</span>
                <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  order_verification_interactive
                </span>
              </p>
              <p className="text-emerald-800 leading-relaxed">
                As soon as this order is created, the recipient will automatically receive an interactive verification WhatsApp message with buttons: <strong>[Yes, Confirm]</strong>, <strong>[Send Screenshot]</strong>, and <strong>[Cancel Order]</strong>.
              </p>
            </div>
          </div>

          {/* Customer selection */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="card-title">Recipient &amp; Customer Details</p>
                <p className="text-[11px] text-muted mt-0.5">
                  The primary entry point to onboard new customers.
                </p>
              </div>
              <div className="flex gap-1.5 bg-surface border border-border p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    customerMode === 'new'
                      ? 'bg-navy text-white shadow-xs'
                      : 'text-muted hover:text-navy'
                  }`}
                >
                  New Recipient
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    customerMode === 'existing'
                      ? 'bg-navy text-white shadow-xs'
                      : 'text-muted hover:text-navy'
                  }`}
                >
                  Existing Customer
                </button>
              </div>
            </div>

            {/* Lifecycle Information Banner */}
            <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3 mb-4 flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
              <ShieldCheck size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-amber-950">Customer Activation on Delivery</p>
                <p className="text-amber-800 mt-0.5 leading-relaxed">
                  In accordance with CRM policy, recipient profiles are formally created as customers once this order is marked <strong>Delivered</strong>. Pre-delivery communication and WhatsApp tracking use these recipient details.
                </p>
              </div>
            </div>

            {customerMode === 'existing' ? (
              selectedCustomer ? (
                <div className="flex items-center justify-between p-3 rounded-md bg-surface border border-border">
                  <div>
                    <p className="text-sm font-medium text-navy">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted">{selectedCustomer.phone} · {selectedCustomer.email || 'no email'}</p>
                    {selectedCustomer.city && (
                      <p className="text-[11px] text-muted mt-0.5">{selectedCustomer.city}, {selectedCustomer.state} - {selectedCustomer.pincode}</p>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Change</Button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    placeholder="Search existing customer by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-8"
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-card-hover max-h-56 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button
                          key={c.id} type="button"
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-surface text-sm border-b border-border last:border-0"
                        >
                          <p className="font-medium text-navy">{c.name}</p>
                          <p className="text-xs text-muted">{c.phone} · {c.source}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Recipient / Customer Name *"
                    placeholder="e.g. Rahul Sharma"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Mobile / WhatsApp Number *"
                    placeholder="e.g. 9876543210"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    required
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="e.g. customer@example.com"
                    className="col-span-2"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  />
                </div>

                <div className="border-t border-border pt-3 mt-3">
                  <p className="text-xs font-bold text-navy flex items-center gap-1.5 mb-2.5">
                    <MapPin size={13} className="text-amber-600" /> Delivery Address
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Address Line 1"
                      placeholder="House/Flat No., Building Name, Street"
                      className="col-span-2"
                      value={newCustomer.address_line1}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address_line1: e.target.value })}
                    />
                    <Input
                      label="Address Line 2"
                      placeholder="Area, Landmark"
                      className="col-span-2"
                      value={newCustomer.address_line2}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address_line2: e.target.value })}
                    />
                    <Input
                      label="City"
                      placeholder="e.g. Mumbai"
                      value={newCustomer.city}
                      onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    />
                    <Input
                      label="State"
                      placeholder="e.g. Maharashtra"
                      value={newCustomer.state}
                      onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                    />
                    <Input
                      label="Pincode"
                      placeholder="e.g. 400001"
                      className="col-span-2"
                      value={newCustomer.pincode}
                      onChange={(e) => {
                        const pin = e.target.value;
                        setNewCustomer({ ...newCustomer, pincode: pin });
                        if (!form.delivery_pincode || form.delivery_pincode === newCustomer.pincode) {
                          update('delivery_pincode', pin);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order details */}
          <div className="card">
            <p className="card-title mb-3">Order Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Channel / Marketplace" value={form.marketplace}
                onChange={(e) => handleMarketplaceChange(e.target.value)}
                options={MARKETPLACES.map(m => ({ value: m, label: m === 'akuabeat_website' ? 'Akuabeat Website' : m.charAt(0).toUpperCase() + m.slice(1) }))}
              />
              <Select
                label="Sub-Channel"
                value={form.sub_channel}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((f) => ({ ...f, sub_channel: val, channel: val }));
                }}
                options={currentSubChannels}
              />
              <Input
                label="Marketplace Order ID" value={form.marketplace_order_id}
                onChange={(e) => update('marketplace_order_id', e.target.value)}
                placeholder="e.g. 405-1234567-1234567"
              />
              <Input
                label="Order Date" type="date" value={form.order_date}
                onChange={(e) => update('order_date', e.target.value)}
              />
              <Input
                label="Product Name" className="col-span-2" value={form.product_name}
                onChange={(e) => update('product_name', e.target.value)}
                placeholder="Product name"
              />
              <Input
                label="Product SKU" value={form.product_sku}
                onChange={(e) => update('product_sku', e.target.value)}
              />
              <Input
                label="Quantity" type="number" min={1} value={form.quantity}
                onChange={(e) => {
                  const q = Number(e.target.value) || 1;
                  update('quantity', q);
                  const price = Number(form.unit_price) || 0;
                  update('total_amount', price ? String(price * q) : '');
                }}
              />
              <Input
                label="Unit Price (₹)" type="number" min={0} step="0.01" value={form.unit_price}
                onChange={(e) => {
                  const unitPrice = e.target.value;
                  const qty = Number(form.quantity) || 1;
                  update('unit_price', unitPrice);
                  update('total_amount', unitPrice ? String(Number(unitPrice) * qty) : '');
                }}
              />
              <Input
                label="Total Amount (₹)" type="number" min={0} step="0.01" value={form.total_amount}
                onChange={(e) => update('total_amount', e.target.value)}
              />
              <Input
                label="Delivery Pincode" value={form.delivery_pincode}
                onChange={(e) => update('delivery_pincode', e.target.value)}
                placeholder="e.g. 400001"
              />
            </div>
            <div className="mt-3">
              <Select
                label="Assigned To"
                value={form.assigned_to}
                onChange={(e) => update('assigned_to', e.target.value)}
                options={[
                  { value: '', label: 'Auto-assign (logged in user)' },
                  ...((users as any[]) || []).map((u: any) => ({ value: u.id, label: `${u.name} (${u.role})` })),
                ]}
              />
              <Textarea
                label="Internal Notes" value={form.internal_notes}
                onChange={(e) => update('internal_notes', e.target.value)}
                placeholder="Any internal remarks about this order..."
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              loading={createOrder.isPending}
              disabled={isSubmitDisabled}
              className="bg-navy hover:bg-navy/90 text-white font-bold"
            >
              Create Order &amp; Send Verification
            </Button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}




