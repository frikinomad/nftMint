import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        // Parse the form data to get the file
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
        }

        // Create a temporary path to save the uploaded file
        const tempFilePath = path.join(process.cwd(), 'uploads', file.name);
        
        // Read the file as a buffer
        const arrayBuffer = Buffer.from(await file.arrayBuffer());
        const uint8Array = new Uint8Array(arrayBuffer);

        
        await fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });

        // Save the file to the server
        await fs.writeFile(tempFilePath, uint8Array);

        // Return the buffer as a base64 encoded string or directly as binary (if supported by your client)
        // Convert to base64 if needed
        // const base64Buffer = Buffer.from(arrayBuffer).toString('base64');
    
        return NextResponse.json({ success: true, fileBuffer: arrayBuffer });
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error }, { status: 500 });
    }
}
