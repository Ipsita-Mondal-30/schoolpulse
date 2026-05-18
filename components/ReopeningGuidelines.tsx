import React, { useState } from 'react';

export default function ReopeningGuidelines() {
  const [activeTab, setActiveTab] = useState<'logistics' | 'vendors' | 'books' | 'homework' | 'uniform'>('logistics');

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-orange-100 to-amber-50 p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏫</div>
          <div>
            <h2 className="text-xl font-bold text-orange-900">Class 1 Reopening Guidelines</h2>
            <p className="text-sm text-orange-800">May 21, 2026 • First day information & rules</p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('logistics')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'logistics' ? 'border-b-2 border-orange-500 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📍 Logistics & Forms
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'vendors' ? 'border-b-2 border-orange-500 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🛍️ Vendor Details
        </button>
        <button
          onClick={() => setActiveTab('books')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'books' ? 'border-b-2 border-orange-500 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📚 Books & Wrapping
        </button>
        <button
          onClick={() => setActiveTab('homework')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'homework' ? 'border-b-2 border-orange-500 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📝 Homework Policy
        </button>
        <button
          onClick={() => setActiveTab('uniform')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'uniform' ? 'border-b-2 border-orange-500 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          👕 Uniform & Rules
        </button>
      </div>

      <div className="p-4 bg-gray-50 min-h-[220px]">
        {activeTab === 'logistics' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">⏰ Timings</h4>
                <p className="text-sm text-gray-600">Report by <strong>7:50 AM</strong>. The gate strictly closes at 8:00 AM.</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">🚗 Pick-up</h4>
                <p className="text-sm text-gray-600"><strong>3:00 PM:</strong> Parent & Private Van<br/><strong>3:15 PM:</strong> School Bus</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">📍 Location</h4>
                <p className="text-sm text-gray-600">Reception Floor, Primary Block. Rooms: P17 to P21.</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200 border-l-4 border-l-red-400">
                <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">⚠️ Mandatory on Day 1</h4>
                <ul className="text-sm text-gray-600 list-disc list-inside">
                  <li>Passport size photo (NOT stamp size)</li>
                  <li>Van Driver Form + Aadhar copy (if applicable)</li>
                  <li>Parent Pick-up Consent Letter (if applicable)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="space-y-4 animate-in fade-in duration-300">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Uniform Vendor */}
               <div className="bg-white p-4 rounded-lg border border-gray-200">
                 <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">👕 Uniform: R A Creations</h4>
                 <div className="text-sm text-gray-600 space-y-2">
                   <p className="bg-blue-50 text-blue-800 p-2 rounded text-xs"><strong>Note:</strong> Shifted to new Jayanagar address (Opposite road to Pantaloon Mall, home-based shop).</p>
                   <p><span className="font-semibold text-gray-800">Address:</span> #1195, 26TH Main, 9th Block, Jayanagar, Opp Road of Ragigudda Temple Arch, Near Village Naturals Store, Bangalore – 560069</p>
                   <p><span className="font-semibold text-gray-800">Phone/WhatsApp:</span> <a href="https://wa.me/917483978799" className="text-blue-600 hover:underline">7483978799</a>, 08035814373</p>
                   <p><span className="font-semibold text-gray-800">Online:</span> <a href="http://racreation.online" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">racreation.online</a></p>
                 </div>
               </div>

               {/* Shoes Vendor */}
               <div className="bg-white p-4 rounded-lg border border-gray-200">
                 <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">👟 Shoes: Sunrise Enterprises</h4>
                 <div className="text-sm text-gray-600 space-y-2">
                   <p><span className="font-semibold text-gray-800">Address:</span> FF-5, Business Point, Brigade Rd, Next to Brigade Tower, Shanthala Nagar, Ashok Nagar, Bengaluru – 560025</p>
                   <p><span className="font-semibold text-gray-800">Phone:</span> 080-41225990</p>
                 </div>
               </div>

               {/* Books Vendor */}
               <div className="bg-white p-4 rounded-lg border border-gray-200 md:col-span-2">
                 <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">📚 Books: Hema Book World</h4>
                 <div className="text-sm text-gray-600 space-y-2">
                   <p><span className="font-semibold text-gray-800">Address:</span> No. 296, 24th Main Rd, Opp. IDBI Bank, JP Nagar 6th Phase, KR Layout, Bengaluru – 560078</p>
                 </div>
               </div>
             </div>
          </div>
        )}

        {activeTab === 'books' && (
          <div className="space-y-4 animate-in fade-in duration-300">
             <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-2 border border-blue-100">
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
             
             <div>
               <h4 className="font-semibold text-gray-800 mb-2">Book Covering Guidelines</h4>
               <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside bg-white p-3 rounded-lg border border-gray-200">
                 <li>All textbooks and workbooks should be wrapped in brown paper (do not bind/stitch).</li>
                 <li>Safety books and &quot;Be an Artist&quot; book must be wrapped, not bound.</li>
                 <li>Wrapping is <strong>not compulsory</strong> for Grade 1.</li>
                 <li>Ensure all items are clearly labelled with Name, Class, and Section.</li>
               </ul>
             </div>

             <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-100">
               <strong>Chandana Kannada Book:</strong> This is a Govt issued book and is typically delayed by a month. The school will distribute it when it arrives. Parents do not need to arrange it.
             </div>
          </div>
        )}

        {activeTab === 'homework' && (
          <div className="space-y-4 animate-in fade-in duration-300">
             <h4 className="font-semibold text-gray-800 mb-2">Holiday Homework Submission (Day 1)</h4>
             <p className="text-sm text-gray-600 mb-3">Holiday homework must be submitted to the respective subject teachers on the first day of school. Applicable for:</p>
             <div className="flex flex-wrap gap-2 mb-4">
               <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">General Awareness</span>
               <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Numeracy</span>
               <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">Kannada</span>
               <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-xs font-medium">Literacy</span>
               <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Hindi</span>
             </div>

             <div className="bg-white p-3 rounded-lg border border-gray-200 border-l-4 border-l-blue-400">
               <h4 className="font-semibold text-gray-800 mb-1">Maths Homework Policy</h4>
               <p className="text-sm text-gray-600">
                 Write numbers 1–100 (weekly) and number names 1–100 (once in two weeks) in a separate square-lined notebook. <strong>This does NOT need to be submitted.</strong>
               </p>
             </div>
          </div>
        )}

        {activeTab === 'uniform' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <ul className="text-sm text-gray-600 space-y-3 bg-white p-4 rounded-lg border border-gray-200">
              <li className="flex gap-2">
                <span className="mt-0.5">👕</span>
                <span><strong>Uniform:</strong> Must be neat and tidy. Proper school uniform is mandatory.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5">✂️</span>
                <span><strong>Hair Code:</strong> Boys must have neatly trimmed hair. Girls with short hair must wear a black band. Girls with long hair must be braided.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5">🎧</span>
                <span><strong>Accessories:</strong> Ear muffs must be black with no fancy designs.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5">📱</span>
                <span><strong>Gadgets & Watches:</strong> No electronic gadgets allowed. Analogue watches are permitted ONLY on your birthday.</span>
              </li>
            </ul>

          </div>
        )}
      </div>
    </div>
  );
}
