import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Edit, FileText, X } from 'lucide-react';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onViewConfig: () => void;
  onEditConfig: () => void;
  blockLabel?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  position,
  onClose,
  onViewConfig,
  onEditConfig,
  blockLabel = 'Block'
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isVisible, onClose]);

  // Calculate adjusted position to keep menu within viewport
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);

  // Update position when menu ref or position changes
  React.useEffect(() => {
    if (!menuRef.current || !isVisible) {
      setAdjustedPosition(position);
      return;
    }

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x + 5; // Small offset from cursor
    let adjustedY = position.y + 5;

    // Estimate menu size if not yet rendered (fallback)
    const menuWidth = menuRect.width || 220; // Approximate width
    const menuHeight = menuRect.height || 120; // Approximate height

    // Adjust horizontal position if menu would go off-screen
    if (position.x + menuWidth > viewportWidth) {
      adjustedX = position.x - menuWidth; // Show to the left of click point
    }

    // Adjust vertical position if menu would go off-screen
    if (position.y + menuHeight > viewportHeight) {
      adjustedY = position.y - menuHeight; // Show above click point
    }

    // Ensure minimum distance from edges
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [position, isVisible]);

  const menuItems = [
    {
      id: 'view-config',
      label: `View ${blockLabel} Config`,
      icon: <Eye size={16} />,
      onClick: onViewConfig
    },
    {
      id: 'edit-config',
      label: `Edit ${blockLabel} Config`,
      icon: <Edit size={16} />,
      onClick: onEditConfig
    }
  ];

  const menuStyle = {
    position: 'fixed' as const,
    left: `${adjustedPosition.x}px`,
    top: `${adjustedPosition.y}px`,
    zIndex: 9999,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    minWidth: '200px',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  };

  const headerStyle = {
    padding: '12px 16px',
    backgroundColor: 'var(--color-surface-light)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const headerTitleStyle = {
    color: 'var(--color-text)',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  };

  const menuItemStyle = {
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderBottom: '1px solid var(--color-border-light)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const menuItemHoverStyle = {
    backgroundColor: 'var(--color-primary-translucent)',
  };

  const menuItemLabelStyle = {
    color: 'var(--color-text)',
    fontSize: '14px',
    fontWeight: '500',
    flex: 1,
  };

  const menuItemDescStyle = {
    color: 'var(--color-text-secondary)',
    fontSize: '11px',
    marginTop: '2px',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              backgroundColor: 'transparent',
            }}
            onClick={onClose}
          />
          
          {/* Context Menu */}
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={menuStyle}
          >
            {/* Header */}
            <div style={headerStyle}>
              <div style={headerTitleStyle}>
                <FileText size={14} />
                {blockLabel} Options
              </div>
              <button
                style={closeButtonStyle}
                onClick={onClose}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Menu Items */}
            <div>
              {menuItems.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    ...menuItemStyle,
                    borderBottom: index === menuItems.length - 1 ? 'none' : menuItemStyle.borderBottom,
                  }}
                  onClick={() => {
                    item.onClick();
                    onClose();
                  }}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, menuItemHoverStyle);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ color: 'var(--color-primary)' }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={menuItemLabelStyle}>
                      {item.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>


          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
