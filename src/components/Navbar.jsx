import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  CommandLineIcon,
  PresentationChartLineIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline';

function Navbar() {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: ChartBarIcon },
    { name: 'Data Upload', href: '/data-upload', icon: DocumentTextIcon },
    { name: 'Preprocessing', href: '/preprocess', icon: CogIcon },
    { name: 'Visualization', href: '/eda', icon: PresentationChartLineIcon },
    { name: 'ML Models', href: '/train', icon: CommandLineIcon },
    { name: 'Reports', href: '/report', icon: DocumentChartBarIcon },
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-screen">
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <Link to="/" className="text-xl font-bold text-blue-600">
          DataSage
        </Link>
      </div>
      <nav className="mt-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <item.icon className={`h-5 w-5 mr-3 ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default Navbar; 