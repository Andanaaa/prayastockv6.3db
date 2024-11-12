import React, { useState, useEffect } from 'react';
import { Calendar, Search, ChevronDown } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

interface Item {
  id: string;
  code: string;
  name: string;
  quantity: number;
}

interface IncomingItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  timestamp: string;
}

export default function IncomingPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateFilter, setDateFilter] = useState<'current_month' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });

  // Fetch items for dropdown
  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('code'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      setItems(itemsList);
    });

    return () => unsubscribe();
  }, []);

  // Fetch incoming items with date filter
  useEffect(() => {
    let incomingQuery;
    const incomingRef = collection(db, 'incoming');
    
    if (dateFilter === 'current_month') {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);
      
      const lastDay = new Date();
      lastDay.setMonth(lastDay.getMonth() + 1);
      lastDay.setDate(0);
      lastDay.setHours(23, 59, 59, 999);
      
      incomingQuery = query(
        incomingRef,
        where('timestamp', '>=', firstDay.toISOString()),
        where('timestamp', '<=', lastDay.toISOString()),
        orderBy('timestamp', 'desc')
      );
    } else {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      incomingQuery = query(
        incomingRef,
        where('timestamp', '>=', start.toISOString()),
        where('timestamp', '<=', end.toISOString()),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribe = onSnapshot(incomingQuery, (snapshot) => {
      const incoming = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IncomingItem[];
      setIncomingItems(incoming);
    });

    return () => unsubscribe();
  }, [dateFilter, startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      toast.error('Pilih barang terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    try {
      // Add incoming record
      await addDoc(collection(db, 'incoming'), {
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.name,
        quantity,
        timestamp: new Date().toISOString()
      });

      // Update item quantity
      const itemRef = doc(db, 'items', selectedItem.id);
      const itemDoc = await getDoc(itemRef);
      if (itemDoc.exists()) {
        const currentQuantity = itemDoc.data().quantity || 0;
        await updateDoc(itemRef, {
          quantity: currentQuantity + quantity
        });
      }

      toast.success('Barang masuk berhasil dicatat');
      setSelectedItem(null);
      setQuantity(1);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error recording incoming:', error);
      toast.error('Gagal mencatat barang masuk');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDateTime = (timestamp: string) => {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Input Barang Masuk</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pilih Barang
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                >
                  <span className={selectedItem ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedItem ? `${selectedItem.code} - ${selectedItem.name}` : 'Pilih barang...'}
                  </span>
                  <ChevronDown size={20} className="text-gray-500" />
                </button>

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div className="p-2">
                      <input
                        type="text"
                        placeholder="Cari barang..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <ul className="max-h-60 overflow-auto">
                      {filteredItems.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDropdown(false);
                              setSearchTerm('');
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                          >
                            {item.code} - {item.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Jumlah
              </label>
              <input
                type="number"
                id="quantity"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedItem}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                (isSubmitting || !selectedItem) ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>

      {/* Incoming History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-800">Riwayat Barang Masuk</h2>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Filter Type */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'current_month' | 'custom')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="current_month">Bulan Ini</option>
                <option value="custom">Pilih Tanggal</option>
              </select>

              {/* Custom Date Range */}
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal & Waktu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kode Barang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Barang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incomingItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    Belum ada data barang masuk
                  </td>
                </tr>
              ) : (
                incomingItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(item.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.itemCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.itemName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}