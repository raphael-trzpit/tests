import { Client } from 'pg';
import axios from 'axios';

interface Invoice {
    id: number;
    customerId: number;
    amount: number;
    date: string;
}

interface DetailedInvoice extends Invoice {
    customerName: string;
    customerEmail: string;
}

const client = new Client({
    user: 'user',
    host: 'localhost',
    database: 'invoicedb',
    password: 'password',
    port: 5432,
});

const hubspotApiKey = 'your-hubspot-api-key';

async function syncInvoices() {
    try {
        await client.connect();
        
        const invoices: Invoice[] = await getAllInvoices();
        
        for (const invoice of invoices) {
            const hubspotInvoiceId = await searchInvoiceInHubSpot(invoice.id);
            
            if (!hubspotInvoiceId) {
                const detailedInvoice = await getDetailedInvoice(invoice.id);
                await pushInvoiceToHubSpot(detailedInvoice);
            } else {
                console.log(`Invoice with ID ${invoice.id} already exists in HubSpot`);
            }
        }

        console.log('Invoices synchronization completed successfully');
    } catch (error) {
        console.error('Error synchronizing invoices:', error);
    } finally {
        await client.end();
    }
}

async function getAllInvoices(): Promise<Invoice[]> {
    const result = await client.query('SELECT id, customer_id, amount, date FROM invoices');
    return result.rows;
}

async function searchInvoiceInHubSpot(invoiceId: number): Promise<number | null> {
    try {
        const response = await axios.get(`https://api.hubapi.com/crm/v3/objects/invoices?hapikey=${hubspotApiKey}&id=${invoiceId}`);
        if (response.data.total > 0) {
            return response.data.results[0].id;
        }
    } catch (error) {
        console.error(`Error searching invoice ${invoiceId} in HubSpot:`, error);
    }
    return null;
}

async function getDetailedInvoice(invoiceId: number): Promise<DetailedInvoice> {
    const result = await client.query(`
        SELECT i.id, i.customer_id, i.amount, i.date, c.name AS customer_name, c.email AS customer_email
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.id = $1
    `, [invoiceId]);
    if (result.rows.length === 0) {
        throw new Error(`No details found for invoice ID ${invoiceId}`);
    }
    return result.rows[0];
}

async function pushInvoiceToHubSpot(invoice: DetailedInvoice): Promise<void> {
    try {
        await axios.post(`https://api.hubapi.com/crm/v3/objects/invoices?hapikey=${hubspotApiKey}`, {
            properties: {
                invoice_id: invoice.id,
                customer_id: invoice.customerId,
                amount: invoice.amount,
                date: invoice.date,
                customer_name: invoice.customerName,
                customer_email: invoice.customerEmail,
            }
        });
        console.log(`Invoice ${invoice.id} pushed to HubSpot successfully`);
    } catch (error) {
        console.error(`Error pushing invoice ${invoice.id} to HubSpot:`, error);
    }
}

syncInvoices();