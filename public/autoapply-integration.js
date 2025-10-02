// AutoApply Integration Script
// This script integrates the dashboard with the autoapply backend API

(function() {
  'use strict';
  
  // Configuration
  const API_BASE = window.location.origin + '/api/autoapply';
  const DEBUG_MODE = true;
  
  // Get auth token (adjust this based on how your app stores tokens)
  function getAuthToken() {
    return localStorage.getItem('authToken') || 
           localStorage.getItem('token') || 
           sessionStorage.getItem('authToken') ||
           sessionStorage.getItem('token');
  }
  
  // API call helper
  async function apiCall(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    
    try {
      const response = await fetch(API_BASE + endpoint, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call failed:', endpoint, error);
      throw error;
    }
  }
  
  // Check profile completeness and update UI
  async function checkProfileStatus() {
    try {
      console.log('🔍 Checking profile status...');
      
      const readiness = await apiCall('/debug/readiness');
      console.log('Profile readiness:', readiness);
      
      const isComplete = readiness.data?.completeness?.complete || false;
      const missingFields = readiness.data?.completeness?.missing;
      
      // Update the autoapply button
      updateAutoApplyButton(isComplete, missingFields);
      
      // Optionally update the profile completion percentage
      if (DEBUG_MODE) {
        updateProfileCompletion(readiness.data);
      }
      
      return isComplete;
      
    } catch (error) {
      console.error('Failed to check profile status:', error);
      // If API call fails, try the quick fix
      return await tryQuickFix();
    }
  }
  
  // Quick profile fix
  async function tryQuickFix() {
    try {
      console.log('🔧 Attempting quick profile fix...');
      
      const result = await apiCall('/complete-profile', { method: 'POST' });
      console.log('Quick fix result:', result);
      
      const isComplete = result.data?.profileComplete || false;
      updateAutoApplyButton(isComplete, result.data?.missingFields);
      
      if (isComplete) {
        showNotification('Profile completed! AutoApply is now ready.', 'success');
      }
      
      return isComplete;
      
    } catch (error) {
      console.error('Quick fix failed:', error);
      updateAutoApplyButton(false, 'API connection failed');
      return false;
    }
  }
  
  // Update the AutoApply button
  function updateAutoApplyButton(isComplete, missingFields) {
    // Find the AutoApply button
    const autoApplyButton = document.querySelector('button[onclick*="autoApply"], button[onclick*="Auto"], [class*="auto-apply"], [id*="auto-apply"]') ||
                           Array.from(document.querySelectorAll('button')).find(btn => 
                             btn.textContent.toLowerCase().includes('auto') ||
                             btn.textContent.toLowerCase().includes('start applying')
                           );
    
    if (!autoApplyButton) {
      console.warn('AutoApply button not found');
      return;
    }
    
    console.log('Found AutoApply button:', autoApplyButton);
    
    if (isComplete) {
      // Enable the button
      autoApplyButton.disabled = false;
      autoApplyButton.style.opacity = '1';
      autoApplyButton.style.cursor = 'pointer';
      
      // Replace the onclick to call our API instead of showing error
      autoApplyButton.onclick = function(e) {
        e.preventDefault();
        startAutoApply();
      };
      
      // Update button text if needed
      if (autoApplyButton.textContent.includes('Complete')) {
        autoApplyButton.textContent = '✓ Start Auto-Applying to Jobs';
      }
      
    } else {
      // Show what's missing
      autoApplyButton.onclick = function(e) {
        e.preventDefault();
        showNotification(`Profile incomplete: ${missingFields || 'Missing required fields'}`, 'error');
        // Try quick fix
        tryQuickFix();
      };
    }
  }
  
  // Start AutoApply process
  async function startAutoApply() {
    try {
      console.log('🚀 Starting AutoApply...');
      
      // Enable autoapply
      const result = await apiCall('/enable', { method: 'POST' });
      console.log('AutoApply enabled:', result);
      
      if (result.success) {
        showNotification('AutoApply enabled successfully! We\'ll start applying to matching jobs.', 'success');
        
        // Redirect to applications view or update UI
        setTimeout(() => {
          window.location.href = '/applications' || window.location.reload();
        }, 2000);
      } else {
        showNotification(result.message || 'Failed to enable AutoApply', 'error');
      }
      
    } catch (error) {
      console.error('Failed to start AutoApply:', error);
      showNotification('Failed to start AutoApply: ' + error.message, 'error');
    }
  }
  
  // Update profile completion display (optional)
  function updateProfileCompletion(data) {
    const completionElement = document.querySelector('[class*="completion"], [id*="completion"]') ||
                             Array.from(document.querySelectorAll('*')).find(el => 
                               el.textContent.includes('75%') || el.textContent.includes('Profile Completion')
                             );
    
    if (completionElement && data) {
      const percentage = data.completeness?.complete ? '100%' : '75%';
      const status = data.completeness?.complete ? 'Complete - Ready for AutoApply!' : 
                    `Incomplete: ${data.completeness?.missing || 'Missing fields'}`;
      
      // Update the text content
      completionElement.innerHTML = completionElement.innerHTML.replace(/75%/, percentage);
      
      // Add status indicator
      const statusEl = document.createElement('div');
      statusEl.style.fontSize = '12px';
      statusEl.style.color = data.completeness?.complete ? '#10b981' : '#f59e0b';
      statusEl.textContent = status;
      
      if (completionElement.nextElementSibling?.classList.contains('autoapply-status')) {
        completionElement.nextElementSibling.remove();
      }
      statusEl.classList.add('autoapply-status');
      completionElement.parentNode.insertBefore(statusEl, completionElement.nextSibling);
    }
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    // Try to use existing notification system or create our own
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000; 
      padding: 12px 20px; border-radius: 6px; color: white; font-weight: 500;
      max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    console.log(`${type.toUpperCase()}: ${message}`);
  }
  
  // Initialize when DOM is ready
  function initialize() {
    console.log('🔧 AutoApply Integration Loading...');
    
    // Add some CSS for better integration
    const style = document.createElement('style');
    style.textContent = `
      .autoapply-status { margin-top: 5px; font-size: 12px; }
      .autoapply-ready { border: 2px solid #10b981 !important; }
      .autoapply-disabled { opacity: 0.6; cursor: not-allowed !important; }
    `;
    document.head.appendChild(style);
    
    // Check profile status
    checkProfileStatus();
    
    console.log('✅ AutoApply Integration Loaded');
  }
  
  // Run when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Expose functions globally for debugging
  if (DEBUG_MODE) {
    window.autoApplyDebug = {
      checkProfile: checkProfileStatus,
      quickFix: tryQuickFix,
      startAutoApply: startAutoApply,
      apiCall: apiCall
    };
    console.log('🐛 Debug functions available: window.autoApplyDebug');
  }
  
})();