'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Pin, PinOff } from 'lucide-react';
import generalInfoData from '@/data/info/general.json';
import busesData from '@/data/info/buses.json';

export default function GeneralInfo() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vendors: true,
  });
  
  const [pinnedBusRoute, setPinnedBusRoute] = useState<string | null>(null);

  useEffect(() => {
    // Load pinned bus from local storage on mount
    const saved = localStorage.getItem('pinnedBusRoute');
    if (saved) {
      setPinnedBusRoute(saved);
    }
  }, []);

  const togglePin = (route: string) => {
    if (pinnedBusRoute === route) {
      setPinnedBusRoute(null);
      localStorage.removeItem('pinnedBusRoute');
    } else {
      setPinnedBusRoute(route);
      localStorage.setItem('pinnedBusRoute', route);
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const themeClasses: Record<string, { bg50: string; bg100: string; bg200: string; border100: string; border200: string; text900: string; }> = {
    blue: {
      bg50: 'bg-blue-50', bg100: 'bg-blue-100', bg200: 'bg-blue-200',
      border100: 'border-blue-100', border200: 'border-blue-200', text900: 'text-blue-900'
    },
    green: {
      bg50: 'bg-green-50', bg100: 'bg-green-100', bg200: 'bg-green-200',
      border100: 'border-green-100', border200: 'border-green-200', text900: 'text-green-900'
    },
    purple: {
      bg50: 'bg-purple-50', bg100: 'bg-purple-100', bg200: 'bg-purple-200',
      border100: 'border-purple-100', border200: 'border-purple-200', text900: 'text-purple-900'
    }
  };

  const pinnedBus = pinnedBusRoute ? busesData.find(b => b.route === pinnedBusRoute) : null;

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

      {/* Pinned Bus Section */}
      {pinnedBus && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-4 border border-yellow-300 rounded-xl shadow-sm animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-yellow-900 flex items-center gap-2">
              <Pin size={18} className="fill-yellow-600 text-yellow-600" /> 
              My Pinned Bus (Route {pinnedBus.route})
            </h3>
            <button 
              onClick={() => togglePin(pinnedBus.route)}
              className="text-yellow-700 hover:text-yellow-900 bg-yellow-200/50 hover:bg-yellow-200 p-1.5 rounded-full transition-colors"
              title="Unpin bus"
            >
              <PinOff size={16} />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between bg-white/60 p-3 rounded-lg border border-yellow-200/50">
            <div>
              <div className="font-medium text-gray-800">Driver: {pinnedBus.driverName}</div>
              <div className="text-sm text-gray-600">Vehicle: <span className="font-semibold">{pinnedBus.vehicle}</span> | Phone: <a href={`tel:${pinnedBus.driverPhone}`} className="text-blue-600 hover:underline">{pinnedBus.driverPhone}</a></div>
            </div>
            <a 
              href={pinnedBus.gprsLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm whitespace-nowrap font-medium"
            >
              <MapPin size={18} />
              Track Bus Live
            </a>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200 overflow-hidden">
        
        {/* School Bus Tracking Section */}
        <div>
          <button 
            onClick={() => toggleSection('buses')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-bold text-gray-800">🚌 School Bus Details and Track</h3>
            <span className="text-gray-500">{openSections['buses'] ? '▲' : '▼'}</span>
          </button>
          {openSections['buses'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200 overflow-x-auto">
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-4 border border-yellow-200 shadow-sm flex items-start gap-2">
                <span>⚠️</span>
                <p>Click the <strong>Track</strong> icon to view the live GPS location of your bus. You can pin your kid's bus to the top of this page using the pin icon.</p>
              </div>
              <table className="w-full text-sm text-left text-gray-600 border border-gray-200 rounded-lg overflow-hidden">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-3 py-3 border-r border-gray-200 text-center w-10">Pin</th>
                    <th scope="col" className="px-3 py-3 border-r border-gray-200 text-center">Route</th>
                    <th scope="col" className="px-4 py-3 border-r border-gray-200 text-center">Track</th>
                    <th scope="col" className="px-4 py-3 border-r border-gray-200">Driver Details</th>
                    <th scope="col" className="px-4 py-3 text-center">Vehicle</th>
                  </tr>
                </thead>
                <tbody>
                  {busesData.map((bus, i) => {
                    const isPinned = pinnedBusRoute === bus.route;
                    return (
                      <tr key={bus.route} className={`${isPinned ? 'bg-yellow-50/50' : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')} border-b border-gray-200`}>
                        <td className="px-3 py-3 border-r border-gray-200 text-center">
                          <button 
                            onClick={() => togglePin(bus.route)}
                            className={`p-1.5 rounded-full transition-colors ${isPinned ? 'text-yellow-600 bg-yellow-100 hover:bg-yellow-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
                            title={isPinned ? "Unpin bus" : "Pin bus to top"}
                          >
                            <Pin size={16} className={isPinned ? "fill-yellow-600" : ""} />
                          </button>
                        </td>
                        <td className="px-3 py-3 border-r border-gray-200 font-bold text-gray-900 text-center bg-yellow-100/30">{bus.route}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center">
                          <a 
                            href={bus.gprsLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:text-blue-900 rounded-full transition-colors shadow-sm"
                            title="Track Bus"
                          >
                            <MapPin size={18} />
                          </a>
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200">
                          <div className="font-semibold text-gray-900">{bus.driverName}</div>
                          <div className="text-xs text-gray-500 mt-0.5"><a href={`tel:${bus.driverPhone}`} className="text-blue-600 hover:underline">{bus.driverPhone}</a></div>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-gray-800 whitespace-nowrap">{bus.vehicle}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Vendors Section */}
        <div>
          <button 
            onClick={() => toggleSection('vendors')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-200"
          >
            <h3 className="text-lg font-bold text-gray-800">🛍️ Vendor Details</h3>
            <span className="text-gray-500">{openSections['vendors'] ? '▲' : '▼'}</span>
          </button>
          {openSections['vendors'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generalInfoData.vendors.map((vendor) => (
                  <div key={vendor.id} className={`bg-gray-50 p-4 rounded-lg border border-gray-200 ${vendor.id === 'books' ? 'md:col-span-2' : ''}`}>
                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">{vendor.icon} {vendor.category}: {vendor.name}</h4>
                    <div className="text-sm text-gray-600 space-y-2">
                      {vendor.note && (
                        <p className="bg-blue-50 text-blue-800 p-2 rounded text-xs"><strong>Note:</strong> {vendor.note}</p>
                      )}
                      {vendor.address && (
                        <p><span className="font-semibold text-gray-800">Address:</span> {vendor.address}</p>
                      )}
                      {vendor.phones && vendor.phones.length > 0 && (
                        <p>
                          <span className="font-semibold text-gray-800">Phone/WhatsApp:</span>{' '}
                          {vendor.phones.map((p, idx) => (
                            <React.Fragment key={p.number}>
                              {p.isWhatsapp ? (
                                <a href={`https://wa.me/91${p.number}`} className="text-blue-600 hover:underline">{p.number}</a>
                              ) : (
                                <span>{p.number}</span>
                              )}
                              {idx < vendor.phones.length - 1 ? ', ' : ''}
                            </React.Fragment>
                          ))}
                        </p>
                      )}
                      {vendor.website && (
                        <p><span className="font-semibold text-gray-800">Online:</span> <a href={`http://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{vendor.website}</a></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contacts Section */}
        <div>
          <button 
            onClick={() => toggleSection('contacts')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-200"
          >
            <h3 className="text-lg font-bold text-gray-800">📞 School Contacts</h3>
            <span className="text-gray-500">{openSections['contacts'] ? '▲' : '▼'}</span>
          </button>
          {openSections['contacts'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generalInfoData.contacts.map((contact, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">{contact.icon} {contact.role}</h4>
                    <div className="text-sm text-gray-600 space-y-2">
                      {contact.note && (
                        <p className="text-gray-400 italic">{contact.note}</p>
                      )}
                      {contact.email && (
                        <p><span className="font-semibold text-gray-800">E-mail:</span> <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a></p>
                      )}
                      {contact.mobiles && contact.mobiles.length > 0 && (
                        <p>
                          <span className="font-semibold text-gray-800">Mobile:</span>{' '}
                          {contact.mobiles.map((mob, mIdx) => (
                            <React.Fragment key={mob}>
                              <a href={`tel:${mob.replace(/ /g, '')}`} className="text-blue-600 hover:underline">{mob}</a>
                              {mIdx < contact.mobiles.length - 1 ? ', ' : ''}
                            </React.Fragment>
                          ))}
                        </p>
                      )}
                      {contact.phone && (
                        <p><span className="font-semibold text-gray-800">Phone:</span> <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a></p>
                      )}
                    </div>
                  </div>
                ))}
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
                  {generalInfoData.teachers.map((row, i) => (
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
                {generalInfoData.houses.map((house) => (
                  <div key={house.name} className={`flex flex-col items-center justify-center p-3 rounded-lg border ${house.borderColor} ${house.bgColor}`}>
                    <div className={`w-8 h-8 rounded-full ${house.circleColor} mb-2 shadow-sm`}></div>
                    <span className={`font-bold ${house.textColor} text-sm text-center`}>{house.name}</span>
                    <span className={`text-xs ${house.subTextColor} mt-1`}>{house.color}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Uniform Schedule Section */}
        <div>
          <button 
            onClick={() => toggleSection('uniform_schedule')}
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-200"
          >
            <h3 className="text-lg font-bold text-gray-800">👕 Uniform Schedule</h3>
            <span className="text-gray-500">{openSections['uniform_schedule'] ? '▲' : '▼'}</span>
          </button>
          {openSections['uniform_schedule'] && (
            <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-4">
                {generalInfoData.uniform_schedule.map((schedule, idx) => {
                  const t = themeClasses[schedule.themeColor] || themeClasses.blue;
                  return (
                    <div key={idx} className={`${t.bg50} border ${t.border100} rounded-xl overflow-hidden`}>
                      <div className={`${t.bg100} px-4 py-2 font-bold ${t.text900} border-b ${t.border200} flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1`}>
                        <span>{schedule.days}</span>
                        {schedule.note && (
                          <span className={`text-xs ${t.bg200} ${t.text900} px-2 py-1 rounded-full self-start sm:self-auto`}>
                            {schedule.note}
                          </span>
                        )}
                      </div>
                      
                      {schedule.boysAndGirls ? (
                        <div className="p-4">
                          <div className={`bg-white p-3 rounded-lg border ${t.border100} shadow-sm flex flex-col md:flex-row gap-2 md:gap-4 md:items-center`}>
                            <div className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">👦 BOYS & 👧 GIRLS</div>
                            <p className="text-sm text-gray-600">{schedule.boysAndGirls}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`bg-white p-3 rounded-lg border ${t.border100} shadow-sm`}>
                            <div className="font-bold text-gray-800 mb-1 flex items-center gap-2">👦 BOYS</div>
                            <p className="text-sm text-gray-600">{schedule.boys}</p>
                          </div>
                          <div className={`bg-white p-3 rounded-lg border ${t.border100} shadow-sm`}>
                            <div className="font-bold text-gray-800 mb-1 flex items-center gap-2">👧 GIRLS</div>
                            <p className="text-sm text-gray-600">{schedule.girls}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
