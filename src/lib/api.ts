const API_URL = '/api';

const handleResponse = async (res: Response) => {
  const contentType = res.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.details || `Server error: ${res.status}`);
    }
    return data;
  } else {
    const text = await res.text();
    let errorMessage = `Server error (${res.status})`;
    
    if (res.status === 429) {
      errorMessage = "Przekroczono limit zapytań (Rate limit exceeded). Proszę odczekać chwilę.";
    } else if (res.status === 503) {
      errorMessage = "Serwer bazy danych jest niedostępny lub trwa łączenie.";
    } else if (res.status === 404) {
      errorMessage = "Nie znaleziono punktu końcowego API.";
    } else {
      errorMessage += `: Expected JSON but received ${contentType || 'unknown content'}.`;
    }

    if (text.includes('<!doctype html>') || text.includes('<html>')) {
      console.error('Received HTML instead of JSON. This usually means a routing error or SPA fallback.');
    }

    console.error(`${errorMessage} Content snippet: ${text.slice(0, 100)}...`);
    throw new Error(errorMessage);
  }
};

export const api = {
  getUsers: () => {
    console.log('Fetching: /api/users');
    return fetch(`${API_URL}/users`).then(handleResponse);
  },
  createUser: (user: any) => {
    console.log('Posting: /api/users');
    return fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    }).then(handleResponse);
  },
  login: (credentials: any) => {
    console.log('Posting: /api/login');
    return fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }).then(handleResponse);
  },
  deleteUser: (id: string) => {
    console.log(`Deleting: /api/users/${id}`);
    return fetch(`${API_URL}/users/${id}`, { method: 'DELETE' }).then(handleResponse);
  },
  
  updateUser: (id: string, user: any) => {
    console.log(`Updating: /api/users/${id}`);
    return fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    }).then(handleResponse);
  },
  
  getEquipment: () => {
    console.log('Fetching: /api/equipment');
    return fetch(`${API_URL}/equipment`).then(handleResponse);
  },
  createEquipment: (eq: any) => {
    console.log('Posting: /api/equipment');
    return fetch(`${API_URL}/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eq)
    }).then(handleResponse);
  },
  updateEquipment: (id: string, eq: any) => {
    console.log(`Updating: /api/equipment/${id}`);
    return fetch(`${API_URL}/equipment/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eq)
    }).then(handleResponse);
  },
  deleteEquipment: (id: string) => {
    console.log(`Deleting: /api/equipment/${id}`);
    return fetch(`${API_URL}/equipment/${id}`, { method: 'DELETE' }).then(handleResponse);
  },
  
  getRentals: () => {
    console.log('Fetching: /api/rentals');
    return fetch(`${API_URL}/rentals`).then(handleResponse);
  },
  createRental: (rental: any) => {
    console.log('Posting: /api/rentals');
    return fetch(`${API_URL}/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rental)
    }).then(handleResponse);
  },
  updateRental: (id: string, rental: any) => {
    console.log(`Updating: /api/rentals/${id}`);
    return fetch(`${API_URL}/rentals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rental)
    }).then(handleResponse);
  },
  
  getReports: () => {
    console.log('Fetching: /api/reports');
    return fetch(`${API_URL}/reports`).then(handleResponse);
  },
  createReport: (report: any) => {
    console.log('Posting: /api/reports');
    return fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    }).then(handleResponse);
  },
  resetStats: () => {
    console.log('Posting: /api/reset-stats');
    return fetch(`${API_URL}/reset-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(handleResponse);
  },
};
