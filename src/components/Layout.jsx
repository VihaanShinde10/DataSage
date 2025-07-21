import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartBarIcon,
  DocumentTextIcon,
  CommandLineIcon,
  DocumentChartBarIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpTrayIcon as UploadIcon,
  HomeIcon,
  AdjustmentsHorizontalIcon,
  CpuChipIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

function Layout({ children }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Upload', href: '/', icon: UploadIcon, current: location.pathname === '/' },
    { name: 'Overview', href: '/overview', icon: HomeIcon, current: location.pathname === '/overview' },
    { name: 'Preprocess', href: '/preprocess', icon: AdjustmentsHorizontalIcon, current: location.pathname === '/preprocess' },
    { name: 'Visualize', href: '/eda', icon: ChartBarIcon, current: location.pathname === '/eda' },
    { name: 'SQL Assistant', href: '/sql-assistant', icon: CommandLineIcon, current: location.pathname === '/sql-assistant' },
    { name: 'Train Models', href: '/train', icon: CpuChipIcon, current: location.pathname === '/train' },
    { name: 'Reports', href: '/report', icon: DocumentChartBarIcon, current: location.pathname === '/report' },
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="md:hidden bg-white shadow-sm border-b border-gray-200 py-2 px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
            DataSage
          </span>
        </Link>
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-md text-gray-500 hover:text-gray-600 focus:outline-none"
        >
          {isSidebarOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for desktop */}
        <div className="hidden md:flex md:flex-col md:w-64 md:flex-shrink-0 bg-white shadow-lg">
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                DataSage
              </span>
            </Link>
          </div>
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
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

        {/* Mobile sidebar */}
        <div className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-gray-600 opacity-75" onClick={() => setIsSidebarOpen(false)}></div>
          <div className={`fixed inset-y-0 left-0 flex flex-col z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
              <Link to="/" className="flex items-center space-x-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                  DataSage
                </span>
              </Link>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-md text-gray-500 hover:text-gray-600 focus:outline-none"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 p-4 overflow-y-auto">
              <ul className="space-y-2">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                          isActive 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
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
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <div className="p-4 md:p-8 max-w-full">
              {children}
            </div>
          </main>

          {/* AI Assistant Chat Panel */}
          <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l border-gray-200 shadow-xl z-30 transition-transform duration-300 transform ${
            isChatOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {/* Chat messages will go here */}
              </div>
              <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ask me anything about your data..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Toggle Button */}
          <button
            onClick={() => setIsChatOpen(true)}
            className={`fixed bottom-6 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 z-20 ${
              isChatOpen ? 'hidden' : 'flex'
            }`}
          >
            <ChatBubbleLeftRightIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Layout; 