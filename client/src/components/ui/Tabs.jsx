import React from 'react';

export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`inline-flex p-1.5 bg-[#FFFFFF] dark:bg-[#17171B] border border-[#ECEAE5] dark:border-[#26262F] rounded-full shadow-sm ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-5 py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 select-none ${
              isActive
                ? 'bg-[#6C63FF] text-white shadow-sm'
                : 'text-[#6B6B70] dark:text-[#98989F] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
