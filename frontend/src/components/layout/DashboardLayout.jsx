import React from 'react';
import Breadcrumbs from '../ui/Breadcrumbs';

const DashboardLayout = ({ children }) => {
  return (
    <div className="dashboard-page-content">
      <Breadcrumbs />
      {children}
    </div>
  );
};

export default DashboardLayout;
