import React, { useState, useEffect } from 'react';
import { PackageX, Search, ChevronDown, Check, X } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

interface Item {
  id: string;
  code: string;
  name: string;
  quantity: number;
}

interface ReturnItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  source: 'cod_failed' | 'damaged';
  storeName: string;
  notes: string;
  timestamp: string;
  status?: 'pending' | 'approved' | 'rejected';
}

const RETURN_SOURCES = [
  { id: 'cod_failed', label: 'COD Gagal' },
  { id: 'damaged', label: 'Barang Rusak' },
] as const;

export default function ReturnPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [source, setSource] = useState<'cod_failed' | 'damaged'>('cod_failed');
  const [storeName, setStoreName] = useState('');
  const [notes, setNotes] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Fetch return items
  useEffect(() => {
    const q = query(collection(db, 'returns'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const returns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReturnItem[];
      setReturnItems(returns);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      toast.error('Pilih barang terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'returns'), {
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.name,
        quantity,
        source,
        storeName,
        notes,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });

      toast.success('Pengembalian barang berhasil dicatat');
      setSelectedItem(null);
      setQuantity(1);
      setStoreName('');
      setNotes('');
    } catch (error) {
      console.error('Error adding return:', error);
      toast.error('Gagal mencatat pengembalian barang');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnAction = async (returnItem: ReturnItem, isApproved: boolean) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      if (isApproved) {
        // Get the current item data
        const itemRef = doc(db, 'items', returnItem.itemId);
        const itemDoc = await getDoc(itemRef);
        
        if (itemDoc.exists()) {
          // Update stock quantity
          const currentQuantity = itemDoc.data().quantity || 0;
          await updateDoc(itemRef, {
            quantity: currentQuantity + returnItem.quantity
          });
          
          // Delete the return record after successful stock update
          await deleteDoc(doc(db, 'returns', returnItem.id));
          toast.success('Barang berhasil dikembalikan ke stock');
        } else {
          toast.error('Data barang tidak ditemukan');
        }
      } else {
        // Mark as rejected and keep the record
        await updateDoc(doc(db, 'returns', returnItem.id), {
          status: 'rejected'
        });
        toast.success('Barang ditandai tidak layak untuk stock');
      }
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Gagal memproses pengembalian barang');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedReturns = returnItems.reduce((acc, item) => {
    if (!acc[item.source]) {
      acc[item.source] = [];
    }
    acc[item.source].push(item);
    return acc;
  }, {} as Record<string, ReturnItem[]>);

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
            <PackageX className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Input Barang Kembali</h2>
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

            {/* Return Source */}
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
                Asal Pengembalian
              </label>
              <select
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value as 'cod_failed' | 'damaged')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {RETURN_SOURCES.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Store Name */}
            <div>
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Toko
              </label>
              <input
                type="text"
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan nama toko"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Keterangan
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tambahkan keterangan..."
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

      {/* Return Tables */}
      {RETURN_SOURCES.map((returnSource) => (
        <div key={returnSource.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Daftar Pengembalian - {returnSource.label}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal & Waktu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Barang
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Toko
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!groupedReturns[returnSource.id] || groupedReturns[returnSource.id].length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      Belum ada data pengembalian
                    </td>
                  </tr>
                ) : (
                  groupedReturns[returnSource.id]
                    .filter(item => item.status !== 'rejected')
                    .map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(item.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.itemName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.storeName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.notes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${item.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                            item.status === 'approved' ? 'bg-green-100 text-green-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {item.status === 'rejected' ? 'Ditolak' :
                           item.status === 'approved' ? 'Diterima' :
                           'Menunggu'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {item.status === 'pending' && (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleReturnAction(item, true)}
                              disabled={isProcessing}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Kembalikan ke stock"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => handleReturnAction(item, false)}
                              disabled={isProcessing}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Tandai tidak layak"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}