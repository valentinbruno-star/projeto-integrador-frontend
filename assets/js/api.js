const API_URL = 'http://localhost:3000/api';

async function fetchItems() {
    const res = await fetch(`${API_URL}/items`);
    return await res.json();
}

async function createItem(item) {
    const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });
    return await res.json();
}
