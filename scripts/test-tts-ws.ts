
import { synthesizeSpeech } from '../services/elevenLabsService';
import fs from 'fs';
import path from 'path';

async function runTest() {
    console.log("Starting TTS WebSocket test...");
    
    if (!process.env.ELEVEN_LABS_API_KEY) {
        console.warn("WARNING: ELEVEN_LABS_API_KEY is not set. Using mocked key.");
         process.env.ELEVEN_LABS_API_KEY = "test_key";
    }

    const outputDir = path.resolve(__dirname, '../out');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    const outputFile = path.join(outputDir, 'test_output.mp3');
    const writeStream = fs.createWriteStream(outputFile);

    try {
        console.log("Initializing synthesizeSpeech...");
        const audioGenerator = synthesizeSpeech("Hello, this is a test run. Checking prosody.");

        console.log("Consuming audio generator...");
        let chunkCount = 0;
        try {
            for await (const audioBuffer of audioGenerator) {
                console.log(`Received audio chunk #${++chunkCount}, size: ${audioBuffer.length} bytes`);
                writeStream.write(audioBuffer);
            }
        } catch (genError) {
             console.error("Generator execution error:", genError);
        }

        console.log("Stream finished.");
        writeStream.end();
        console.log(`Audio saved to ${outputFile}`);

    } catch (error) {
        console.error("Test setup failed:", error);
    }
}

runTest().catch(err => console.error("Unhandled top-level error:", err));
