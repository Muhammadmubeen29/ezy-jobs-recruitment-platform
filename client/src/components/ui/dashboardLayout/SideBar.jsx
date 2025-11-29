import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { FaBars, FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';

const SideBar = ({ navItems = [] }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const location = useLocation();

  const itemsToDisplay = navItems.length > 0 ? navItems : [];

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('sidebarChange', {
        detail: { collapsed },
      })
    );
  }, [collapsed]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsVisible(true);
      else setIsVisible(false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
    setIsVisible(!isVisible);
  };

  return (
    <>
      {isMobile && (
        <button
          onClick={toggleCollapse}
          aria-label={isVisible ? 'Close sidebar' : 'Open sidebar'}
          className={`fixed bottom-20 left-4 z-50 transform rounded-lg bg-light-secondary p-3 text-dark-text shadow-lg transition-transform duration-300 ease-in-out hover:scale-110 dark:bg-dark-secondary ${isVisible ? 'translate-y-0' : 'translate-y-full'} ${collapsed ? 'rotate-180' : ''}`}
        >
          {isVisible ? (
            <FaTimes className="text-lg" />
          ) : (
            <FaBars className="text-lg" />
          )}
        </button>
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-light-border bg-light-background transition-all duration-300 ease-in-out dark:border-dark-border dark:bg-dark-background md:translate-x-0 ${isVisible ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-16' : 'w-64'}`}
      >
        <nav className="mt-20 flex-1 overflow-y-auto p-3">
          <ul className="space-y-2">
            {itemsToDisplay.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={index}>
                  <Link
                    to={item.path}
                    onClick={() => {
                      if (!collapsed) toggleCollapse();
                      if (isMobile) setIsVisible(false);
                      window.dispatchEvent(
                        new CustomEvent('sidebarChange', {
                          detail: { collapsed: true },
                        })
                      );
                    }}
                    className={`group flex items-center rounded-lg p-2.5 transition-all duration-300 ease-in-out ${
                      isActive
                        ? 'bg-light-primary text-white shadow-lg shadow-light-primary/30 dark:bg-dark-primary dark:shadow-dark-primary/30'
                        : 'text-light-text hover:bg-light-surface hover:translate-x-1 hover:shadow-md hover:shadow-light-border/20 dark:text-dark-text dark:hover:bg-dark-surface dark:hover:shadow-dark-border/20'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <span
                      className={`text-lg transition-all duration-300 ${
                        isActive
                          ? 'text-white'
                          : 'text-light-text/70 group-hover:text-light-primary group-hover:scale-110 dark:text-dark-text/70 dark:group-hover:text-dark-primary'
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span
                        className={`ml-3 text-base font-medium transition-all duration-300 ${
                          isActive
                            ? 'text-white'
                            : 'text-light-text group-hover:text-light-primary group-hover:font-semibold dark:text-dark-text dark:group-hover:text-dark-primary'
                        }`}
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {!isMobile && (
          <div className="border-t border-light-border p-3 dark:border-dark-border">
            <button
              onClick={toggleCollapse}
              className={`group flex w-full items-center rounded-lg p-2.5 text-light-text transition-all duration-300 ease-in-out hover:bg-light-surface hover:translate-x-1 hover:shadow-md hover:shadow-light-border/20 dark:text-dark-text dark:hover:bg-dark-surface dark:hover:shadow-dark-border/20 ${collapsed ? 'justify-center' : ''}`}
            >
              {collapsed ? (
                <FaChevronRight className="text-lg transition-all duration-300 group-hover:text-light-primary group-hover:scale-110 dark:group-hover:text-dark-primary" />
              ) : (
                <FaChevronLeft className="text-lg transition-all duration-300 group-hover:text-light-primary group-hover:scale-110 dark:group-hover:text-dark-primary" />
              )}
              {!collapsed && (
                <span className="ml-3 text-base font-medium transition-all duration-300 group-hover:text-light-primary group-hover:font-semibold dark:group-hover:text-dark-primary">
                  {collapsed ? 'Expand' : 'Collapse'}
                </span>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

SideBar.propTypes = {
  navItems: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
      icon: PropTypes.element,
    })
  ),
};

export default SideBar;
