'use client';

import React, { useState } from 'react';

export default function ReopeningGuidelines() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    logistics: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const shareGuidelines = async () => {
    const text = `🏫 *Class 1 Reopening - BGSNPS*\n📅 *May 21, 2026*\n\n` +
                 `*Day 1 Important Reminders:*\n` +
                 `📍 Report by 7:50 AM\n` +
                 `📚 Bring Day 1 Books (English, Maths, EVS, etc.)\n` +
                 `🛍️ Note: Uniform Shop (R A Creations) has moved!\n\n` +
                 `Tap the link below for the complete Day 1 rules, homework policies, and pick-up logistics!\n\n` +
                 `_via SchoolPuls_ 💓\n🔗 https://www.schoolpuls.in/`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Class 1 Reopening Guidelines',
          text: text,
        });
      } catch (err) {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-100 to-amber-50 p-4 border border-orange-200 rounded-xl shadow-sm flex flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏫</div>
          <div>
            <h2 className="text-xl font-bold text-orange-900">Class 1 Reopening Guidelines</h2>
            <p className="text-sm text-orange-800">May 21, 2026 • First day information & rules</p>
          </div>
        </div>
        <button 
          onClick={shareGuidelines}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs sm:text-sm font-medium shadow-sm whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Share Guide
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200 overflow-hidden">
        
        {/* Logistics Section */}
        <div>
          <button 
            onClick={() => toggleSection('logistics')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-bold text-gray-800">📍 Logistics & Forms</h3>
            <span className="text-gray-500">{openSections['logistics'] ? '▲' : '▼'}</span>
          </button>
          {openSections['logistics'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">⏰ Timings</h4>
                  <p className="text-sm text-gray-600">Report by <strong>7:50 AM</strong>. The gate strictly closes at 8:00 AM.</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">🚗 Pick-up</h4>
                  <p className="text-sm text-gray-600"><strong>3:00 PM:</strong> Parent & Private Van<br/><strong>3:15 PM:</strong> School Bus</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">📍 Location</h4>
                  <p className="text-sm text-gray-600">Reception Floor, Primary Block. Rooms: P17 to P21.</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-1 flex items-center gap-2">⚠️ Mandatory on Day 1</h4>
                  <ul className="text-sm text-red-700 list-disc list-inside">
                    <li>Upload Passport size photo to Google Form (do NOT send to school)</li>
                    <li>Van Driver Form + Aadhar copy (if applicable)</li>
                    <li>Parent Pick-up Consent Letter (if applicable)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

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

        {/* Books Section */}
        <div>
          <button 
            onClick={() => toggleSection('books')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-bold text-gray-800">📚 Books & Wrapping</h3>
            <span className="text-gray-500">{openSections['books'] ? '▲' : '▼'}</span>
          </button>
          {openSections['books'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">
                <strong>Note:</strong> The Student&apos;s Handbook is NOT part of the kit. It will be issued directly by the class teacher.
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Phased Book Submission Schedule</h4>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden text-sm mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Books to Send</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-gray-600">
                      <tr>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">21 May (Thu)</td>
                        <td className="px-3 py-2">English, Maths, EVS, Value Ed, Art, Cursive Writing, Hindi TBs</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">22 May (Fri)</td>
                        <td className="px-3 py-2">Computer Science TB + required notebooks</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">25 May (Mon)</td>
                        <td className="px-3 py-2">English Grammar TB + folder</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">26 May (Tue)</td>
                        <td className="px-3 py-2">All workbooks</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-100">
                <strong>Chandana Kannada Book:</strong> This is a Govt issued book and is typically delayed by a month. The school will distribute it when it arrives. Parents do not need to arrange it.
              </div>
            </div>
          )}
        </div>

        {/* Homework Section */}
        <div>
          <button 
            onClick={() => toggleSection('homework')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-bold text-gray-800">📝 Homework Policy</h3>
            <span className="text-gray-500">{openSections['homework'] ? '▲' : '▼'}</span>
          </button>
          {openSections['homework'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Holiday Homework Submission (Day 1)</h4>
                <p className="text-sm text-gray-600 mb-3">Holiday homework must be submitted to the respective subject teachers on the first day of school. Applicable for:</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">General Awareness</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Numeracy</span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">Kannada</span>
                  <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-xs font-medium">Literacy</span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Hindi</span>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-1">Maths Homework Policy</h4>
                <p className="text-sm text-blue-800">
                  Write numbers 1–100 (weekly) and number names 1–100 (once in two weeks) in a separate square-lined notebook. <strong>This does NOT need to be submitted.</strong>
                </p>
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
