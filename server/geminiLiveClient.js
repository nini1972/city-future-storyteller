import { GoogleGenAI, Modality } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SYSTEM_PROMPT = "You are the visionary 'City Futures' guide... Ask the user for their city and their preferred future aesthetics (e.g., Solarpunk, Cyberpunk, Bio-integrated architecture). Then, narrate an immersive, highly sensory journey through that future city. Be concise but highly descriptive. Crucially: as you narrate, periodically call the tool `generate_visual_context` with a highly detailed prompt to show the user what you are describing. ALWAYS provide the context prompt before starting the narration of that section.";

export class GeminiLiveClient {
    constructor(apiKey, onData) {
        this.apiKey = apiKey;
        this.ai = new GoogleGenAI({ apiKey });
        this.onData = onData; // Callback to send data to our proxy client
        this.session = null;
    }

    async connect(systemPrompt = DEFAULT_SYSTEM_PROMPT) {
        try {
            this.session = await this.ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-latest',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                         voiceConfig: {
                             prebuiltVoiceConfig: {
                                 voiceName: "Aoede" // Choose a nice voice: Aoede, Charon, Fenrir, Kore, Puck
                             }
                         }
                    },
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    tools: [{
                        functionDeclarations: [{
                            name: "generate_visual_context",
                            description: "Generate a visual representation of the scene you are describing to the user.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    prompt: {
                                        type: "STRING",
                                        description: "A highly detailed, cinematic, high-quality image generation prompt describing the futuristic city scene. For example: 'A vibrant solarpunk street in London with glowing bioluminescent plants and flying tram cars'."
                                    }
                                },
                                required: ["prompt"]
                            }
                        }]
                    }]
                },
                callbacks: {
                    onopen: () => {
                        console.log('Connected to Gemini Live API via SDK');
                    },
                    onmessage: (data) => {
                        try {
                            // Check for tool calls (SDK format is data.toolCall.functionCalls)
                            if (data.toolCall && data.toolCall.functionCalls) {
                                console.log('\n--- INCOMING TOOL CALL ---\n', JSON.stringify(data.toolCall, null, 2));
                                data.toolCall.functionCalls.forEach(fc => {
                                    this.handleFunctionCall(fc);
                                });
                            }
                            
                            // Forward the full response back to the client
                            if (data.serverContent && data.serverContent.modelTurn) {
                                const parts = data.serverContent.modelTurn.parts;
                                if (parts && parts.length > 0 && parts[0].inlineData) {
                                    // Log only periodically to avoid spam
                                    if (Math.random() < 0.05) {
                                        console.log('[Server] Forwarding audio chunk. Type:', typeof parts[0].inlineData.data, 'IsBuffer:', Buffer.isBuffer(parts[0].inlineData.data));
                                    }
                                }
                            }
                            this.onData(data);
                        } catch (error) {
                             console.error('Error handling Gemini API message:', error);
                        }
                    },
                    onclose: (e) => {
                         console.log(`Disconnected from Gemini Live API. Close code: ${e?.code}, Reason: ${e?.reason}`);
                    },
                    onerror: (error) => {
                        console.error('Gemini API WebSocket error:', error);
                        this.onData({ error: `Connection to Gemini failed` });
                    }
                }
            });
        } catch (error) {
            console.error("Failed to connect to Gemini Live:", error);
            this.onData({ error: `Connection to Gemini failed: ${error.message}` });
        }
    }

    async handleFunctionCall(functionCall) {
        console.log(`Gemini called tool: ${functionCall.name}`);
        if (functionCall.name === 'generate_visual_context') {
            const args = functionCall.args;
            const prompt = args.prompt || args.context;
            console.log('Visual prompt received:', prompt);

            try {
                console.log('Requesting Google Imagen 4.0 generation...');
                // We use our existing initialized this.ai SDK client to fetch the image.
                const response = await this.ai.models.generateImages({
                    model: 'imagen-4.0-fast-generate-001',
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: '16:9' // Cinematic aspect ratio for scenes
                    }
                });

                const img = response.generatedImages[0].image;
                const imageUrl = `data:${img.mimeType};base64,${img.imageBytes}`;
                console.log('Imagen generation successful. Pushing to client...');

                // Send custom visual_context message to the frontend client
                this.onData({
                    type: "custom",
                    visual_context: {
                        imageUrl: imageUrl,
                        prompt: prompt
                    }
                });

                // --- NEW: Save to history ---
                try {
                    const historyDir = path.join(__dirname, 'public', 'history');
                    if (!fs.existsSync(historyDir)) {
                        fs.mkdirSync(historyDir, { recursive: true });
                    }
                    
                    const timestamp = Date.now();
                    const filename = `img_${timestamp}.jpg`;
                    const filepath = path.join(historyDir, filename);
                    
                    // Save the base64 image bytes to disk
                    fs.writeFileSync(filepath, Buffer.from(img.imageBytes, 'base64'));
                    
                    // Maintain a JSON log of all prompts
                    const logPath = path.join(historyDir, 'history.json');
                    let logData = [];
                    if (fs.existsSync(logPath)) {
                        logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
                    }
                    logData.push({
                        timestamp,
                        filename,
                        prompt
                    });
                    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
                    console.log(`Saved image to ${filename} and updated history.json`);
                } catch (saveError) {
                    console.error("Failed to save image to history:", saveError);
                }
            } catch (error) {
                console.error("Imagen generation failed:", error.message);
                // Fallback to a placeholder or skip if it fails, so the app doesn't crash
            }

            if (this.session) {
                // CRITICAL FIX: gemini-2.5-flash-native-audio drops with 1007 if we send JSON tool responses.
                // Since it streams audio concurrently anyway, we just execute the tool statefully on the client side 
                // and purposely DO NOT send a toolResponse back to the API. 
                console.log('\n--- SKIPPING OUTGOING TOOL RESPONSE TO PREVENT 1007 CRASH ---\n');
                // const toolResponseMessage = { ... };
                // this.session.sendToolResponse(toolResponseMessage);
            }
        }
    }

    send(data) {
        if (this.session) {
             if (data.realtimeInput) {
                 // Forward real-time input (audio chunks) directly to the SDK
                 // The SDK internally expects `{ media: { mimeType, data } }`
                 if (data.realtimeInput.mediaChunks && data.realtimeInput.mediaChunks.length > 0) {
                     this.session.sendRealtimeInput({ media: data.realtimeInput.mediaChunks[0] });
                 }
             } else if (data.clientContent) {
                 // CRITICAL FIX: Ignore explicit turnComplete messages from client because 
                 // the native audio model's VAD triggers automatically and rejects JSON control messages.
                 console.log('Skipping forwarding of clientContent (turnComplete) to prevent 1007 crash.');
                 // this.session.sendClientContent(data.clientContent);
             }
        }
    }

    disconnect() {
        if (this.session) {
            try {
                this.session.close();
            } catch (e) {
                console.log("WebSocket close error ignored (likely already closed)");
            }
            this.session = null;
        }
    }
}
