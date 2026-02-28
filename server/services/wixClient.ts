// genOS Full v1.0.0 "Lumina" — wixClient.ts
// Wix Data REST API client for CMS operations

const WIX_API_BASE = 'https://www.wixapis.com/wix-data/v2';

interface WixConfig {
  apiKey: string;
  siteId: string;
}

function getConfig(): WixConfig {
  return {
    apiKey: process.env.WIX_API_KEY || '',
    siteId: process.env.WIX_SITE_ID || '',
  };
}

function getHeaders(): Record<string, string> {
  const config = getConfig();
  return {
    'Content-Type': 'application/json',
    'Authorization': config.apiKey,
    'wix-site-id': config.siteId,
  };
}

export interface WixItem {
  _id?: string;
  [key: string]: unknown;
}

/**
 * Query items from a Wix collection
 */
export async function queryCollection(
  collectionId: string,
  filter?: Record<string, unknown>,
  limit: number = 50,
  offset: number = 0
): Promise<{ items: WixItem[]; totalCount: number }> {
  const body: Record<string, unknown> = {
    dataCollectionId: collectionId,
    query: {
      filter: filter || {},
      paging: { limit, offset },
    },
  };

  const res = await fetch(`${WIX_API_BASE}/items/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Wix query failed [${res.status}]: ${errorText}`);
  }

  const data: any = await res.json();
  return {
    items: data.dataItems || [],
    totalCount: data.pagingMetadata?.total || 0,
  };
}

/**
 * Insert a single item into a Wix collection
 */
export async function insertItem(
  collectionId: string,
  item: WixItem
): Promise<WixItem> {
  const res = await fetch(`${WIX_API_BASE}/items`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      dataCollectionId: collectionId,
      dataItem: { data: item },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Wix insert failed [${res.status}]: ${errorText}`);
  }

  const data: any = await res.json();
  return data.dataItem?.data || {};
}

/**
 * Update a single item in a Wix collection
 */
export async function updateItem(
  collectionId: string,
  itemId: string,
  item: WixItem
): Promise<WixItem> {
  const res = await fetch(`${WIX_API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      dataCollectionId: collectionId,
      dataItem: { _id: itemId, data: { ...item, _id: itemId } },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Wix update failed [${res.status}]: ${errorText}`);
  }

  const data: any = await res.json();
  return data.dataItem?.data || {};
}

/**
 * Bulk insert items into a Wix collection
 */
export async function bulkInsert(
  collectionId: string,
  items: WixItem[]
): Promise<{ inserted: number; errors: string[] }> {
  const res = await fetch(`${WIX_API_BASE}/bulk/items/insert`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      dataCollectionId: collectionId,
      dataItems: items.map(item => ({ data: item })),
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Wix bulk insert failed [${res.status}]: ${errorText}`);
  }

  const data: any = await res.json();
  return {
    inserted: data.results?.length || 0,
    errors: data.bulkActionMetadata?.undetailedFailures || [],
  };
}

/**
 * Bulk update items in a Wix collection
 */
export async function bulkUpdate(
  collectionId: string,
  items: WixItem[]
): Promise<{ updated: number; errors: string[] }> {
  const res = await fetch(`${WIX_API_BASE}/bulk/items/update`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      dataCollectionId: collectionId,
      dataItems: items.map(item => ({ _id: item._id, data: item })),
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Wix bulk update failed [${res.status}]: ${errorText}`);
  }

  const data: any = await res.json();
  return {
    updated: data.results?.length || 0,
    errors: data.bulkActionMetadata?.undetailedFailures || [],
  };
}

/**
 * Check if Wix API is configured and reachable
 */
export async function checkConnection(): Promise<{ connected: boolean; error?: string }> {
  const config = getConfig();
  if (!config.apiKey || config.apiKey === 'your-wix-api-key-here') {
    return { connected: false, error: 'WIX_API_KEY not configured' };
  }
  try {
    await queryCollection('ClientAccounts', {}, 1, 0);
    return { connected: true };
  } catch (err) {
    return { connected: false, error: String(err) };
  }
}
