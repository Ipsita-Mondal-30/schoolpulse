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
            <p className="text-sm text-orange-800">Vendor and teacher details</p>
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

        {/* Teachers Section */}
        <div>
          <button 
            onClick={() => toggleSection('teachers')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-200"
          >
            <h3 className="text-lg font-bold text-gray-800">👩‍🏫 Class Teachers (Grade 1)</h3>
            <span className="text-gray-500">{openSections['teachers'] ? '▲' : '▼'}</span>
          </button>
          {openSections['teachers'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200 overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600 border border-gray-200">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-4 py-3 border-r border-gray-200 whitespace-nowrap">Class & Sec.</th>
                    <th scope="col" className="px-4 py-3 border-r border-gray-200 whitespace-nowrap">Class Teacher</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Mail ID</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { sec: '1A', teacher: 'Ms. SUVARNA M', email: 'bgsnpsclassteacher1a2026@gmail.com' },
                    { sec: '1B', teacher: 'Ms. SHUBHA B', email: 'bgsnpsclassteacher1b2026@gmail.com' },
                    { sec: '1C', teacher: 'Ms. LAVANYA MJ', email: 'bgsnpsclassteacher1c2026@gmail.com' },
                    { sec: '1D', teacher: 'Ms. NEETU SINGH', email: 'bgsnpsclassteacher1d2026@gmail.com' },
                    { sec: '1E', teacher: 'Ms. P MONA RAJ', email: 'bgsnpsclassteacher1e2026@gmail.com' },
                    { sec: '1F', teacher: 'Ms. RAJESWARI S', email: 'bgsnpsclassteacher1f2026@gmail.com' },
                    { sec: '1G', teacher: 'Ms. JENIFER J', email: 'bgsnpsclassteacher1g2026@gmail.com' },
                    { sec: '1H', teacher: 'Ms. SHUBHA GOPAL', email: 'bgsnpsclassteacher1h2026@gmail.com' },
                    { sec: '1I', teacher: 'Ms. NEETHU KRISHNAN TS', email: 'bgsnpsclassteacher1i2026@gmail.com' },
                    { sec: '1J', teacher: 'Ms. ANITHA K', email: 'bgsnpsclassteacherof1j@gmail.com' },
                    { sec: '1K', teacher: 'Ms. MONIKA SINHA', email: 'bgsnpsclassteacher1k2026@gmail.com' },
                  ].map((row, i) => (
                    <tr key={row.sec} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50 border-b border-t border-gray-100'}>
                      <td className="px-4 py-2 border-r border-gray-200 font-medium text-gray-900 whitespace-nowrap">{row.sec}</td>
                      <td className="px-4 py-2 border-r border-gray-200 whitespace-nowrap">{row.teacher}</td>
                      <td className="px-4 py-2">
                        <a href={`mailto:${row.email}`} className="text-blue-600 hover:underline">{row.email}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Houses Section */}
        <div>
          <button 
            onClick={() => toggleSection('houses')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-200"
          >
            <h3 className="text-lg font-bold text-gray-800">🏠 House Colors</h3>
            <span className="text-gray-500">{openSections['houses'] ? '▲' : '▼'}</span>
          </button>
          {openSections['houses'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-purple-200 bg-purple-50">
                  <div className="w-8 h-8 rounded-full bg-purple-600 mb-2 shadow-sm"></div>
                  <span className="font-bold text-purple-900 text-sm text-center">NARMADA</span>
                  <span className="text-xs text-purple-700 mt-1">Purple</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-blue-200 bg-blue-50">
                  <div className="w-8 h-8 rounded-full bg-blue-600 mb-2 shadow-sm"></div>
                  <span className="font-bold text-blue-900 text-sm text-center">KAVERI</span>
                  <span className="text-xs text-blue-700 mt-1">Blue</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-orange-200 bg-orange-50">
                  <div className="w-8 h-8 rounded-full bg-orange-500 mb-2 shadow-sm"></div>
                  <span className="font-bold text-orange-900 text-sm text-center">GANGA</span>
                  <span className="text-xs text-orange-700 mt-1">Orange</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-red-200 bg-red-50">
                  <div className="w-8 h-8 rounded-full bg-[#800000] mb-2 shadow-sm"></div>
                  <span className="font-bold text-[#800000] text-sm text-center">BRAHMAPUTRA</span>
                  <span className="text-xs text-[#800000] mt-1">Maroon</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
