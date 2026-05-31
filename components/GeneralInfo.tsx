'use client';

import React, { useState } from 'react';

export default function GeneralInfo() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vendors: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-100 to-amber-50 p-4 border border-orange-200 rounded-xl shadow-sm flex flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">ℹ️</div>
          <div>
            <h2 className="text-xl font-bold text-orange-900">General Info & Rules</h2>
            <p className="text-sm text-orange-800">Vendor details and uniform code</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200 overflow-hidden">
        
        {/* Vendors Section */}
        <div>
          <button 
            onClick={() => toggleSection('vendors')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-bold text-gray-800">🛍️ Vendor Details</h3>
            <span className="text-gray-500">{openSections['vendors'] ? '▲' : '▼'}</span>
          </button>
          {openSections['vendors'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">👕 Uniform: R A Creations</h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p className="bg-blue-50 text-blue-800 p-2 rounded text-xs"><strong>Note:</strong> Shifted to new Jayanagar address (Opposite road to Pantaloon Mall, home-based shop).</p>
                    <p><span className="font-semibold text-gray-800">Address:</span> #1195, 26TH Main, 9th Block, Jayanagar, Opp Road of Ragigudda Temple Arch, Near Village Naturals Store, Bangalore – 560069</p>
                    <p><span className="font-semibold text-gray-800">Phone/WhatsApp:</span> <a href="https://wa.me/917483978799" className="text-blue-600 hover:underline">7483978799</a>, 08035814373</p>
                    <p><span className="font-semibold text-gray-800">Online:</span> <a href="http://racreation.online" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">racreation.online</a></p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">👟 Shoes: Sunrise Enterprises</h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p><span className="font-semibold text-gray-800">Address:</span> FF-5, Business Point, Brigade Rd, Next to Brigade Tower, Shanthala Nagar, Ashok Nagar, Bengaluru – 560025</p>
                    <p><span className="font-semibold text-gray-800">Phone:</span> 080-41225990</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 md:col-span-2">
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">📚 Books: Hema Book World</h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p><span className="font-semibold text-gray-800">Address:</span> No. 296, 24th Main Rd, Opp. IDBI Bank, JP Nagar 6th Phase, KR Layout, Bengaluru – 560078</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Uniform Section */}
        <div>
          <button 
            onClick={() => toggleSection('uniform')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-bold text-gray-800">👕 Uniform & Rules</h3>
            <span className="text-gray-500">{openSections['uniform'] ? '▲' : '▼'}</span>
          </button>
          {openSections['uniform'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <ul className="text-sm text-gray-600 space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <li className="flex gap-3">
                  <span className="text-xl">👕</span>
                  <div>
                    <strong>Uniform Code</strong><br/>
                    Must be neat and tidy. Proper school uniform is mandatory everyday.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-xl">✂️</span>
                  <div>
                    <strong>Hair Styles</strong><br/>
                    Boys must have neatly trimmed hair. Girls with short hair must wear a black band. Girls with long hair must be braided.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-xl">🎧</span>
                  <div>
                    <strong>Accessories</strong><br/>
                    Ear muffs must be black with no fancy designs.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-xl">📱</span>
                  <div>
                    <strong>Gadgets & Watches</strong><br/>
                    No electronic gadgets allowed. Analogue watches are permitted ONLY on your birthday.
                  </div>
                </li>
              </ul>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
