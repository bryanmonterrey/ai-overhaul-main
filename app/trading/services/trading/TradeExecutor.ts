// services/trading/TradeExecutor.ts
import { Connection, Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { Jupiter } from '@jup-ag/core';
import JSBI from 'jsbi';
import { SessionManager } from '../session/SessionManager';
import { WebSocketHandler } from '../websocket/WebSocketHandler';
import { TradeParams, TradeExecutionResponse, RouteQuoteResponse, TradeConfig } from './types';

export class TradeExecutor {
    private jupiter!: Jupiter;
    private connection: Connection;
    private sessionManager: SessionManager;
    private wsHandler: WebSocketHandler;
    private config: TradeConfig;

    constructor(
        connection: Connection,
        sessionManager: SessionManager,
        wsHandler: WebSocketHandler,
        config: Partial<TradeConfig> = {}
    ) {
        this.connection = connection;
        this.sessionManager = sessionManager;
        this.wsHandler = wsHandler;
        this.config = {
            blockEngineUrl: 'https://frankfurt.jito.wtf/',
            maxRetries: 3,
            retryDelay: 1000,
            maxSlippage: 100, // 1%
            ...config
        };
        // Initialize Jupiter immediately
        Jupiter.load({
            connection: this.connection,
            cluster: 'mainnet-beta'
        }).then(jupiter => {
            this.jupiter = jupiter;
        });
    }

    public async initialize(): Promise<void> {
        this.jupiter = await Jupiter.load({
            connection: this.connection,
            cluster: 'mainnet-beta'
        });
    }

    public async executeTradeWithMEV(params: TradeParams): Promise<TradeExecutionResponse> {
        try {
            // Validate session if provided
            if (params.wallet) {
                const isValid = await this.sessionManager.validateSession(
                    params.wallet.publicKey.toString(),
                    params.sessionId
                );
                if (!isValid) {
                    throw new Error('Invalid or expired session');
                }
            }

            // Get route quote
            const quote = await this.getRouteQuote(params);
            if (!quote.success || !quote.route) {
                throw new Error('Failed to get route quote');
            }

            // Execute trade
            const { swapTransaction } = await this.jupiter.exchange({
                routeInfo: quote.route,
                userPublicKey: new PublicKey(params.wallet.publicKey),
            });

            // Sign transaction
            let signedTx: Transaction | VersionedTransaction;
            if (swapTransaction instanceof VersionedTransaction) {
                signedTx = await params.wallet.signTransaction(swapTransaction);
            } else {
                signedTx = swapTransaction;
            }

            // Submit to block engine
            const bundleId = await this.submitToBlockEngine(signedTx);

            // Notify via WebSocket
            this.wsHandler.send({
                type: 'trade_status',
                data: {
                    tradeId: bundleId,
                    status: 'pending',
                }
            });

            // Monitor transaction
            const signature = await this.monitorTransaction(bundleId);

            return {
                success: true,
                signature,
                inputAmount: Number(quote.route.inAmount),
                outputAmount: Number(quote.route.outAmount),
                price: quote.price,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Trade execution error:', error);
            throw error;
        }
    }

    public async getRouteQuote(params: TradeParams): Promise<RouteQuoteResponse> {
        try {
            const routes = await this.jupiter.computeRoutes({
                inputMint: new PublicKey(params.inputMint),
                outputMint: new PublicKey(params.outputMint),
                amount: JSBI.BigInt(params.amount.toString()),
                slippageBps: Math.min(params.slippage * 100, this.config.maxSlippage),
            });

            if (!routes.routesInfos?.length) {
                throw new Error('No routes found');
            }

            const bestRoute = routes.routesInfos[0];
            const outAmount = Number(bestRoute.outAmount.toString());
            const inAmount = Number(bestRoute.inAmount.toString());

            // Notify quote update via WebSocket
            this.wsHandler.send({
                type: 'quote_update',
                data: {
                    inputMint: params.inputMint,
                    outputMint: params.outputMint,
                    price: outAmount / inAmount,
                    priceImpact: bestRoute.priceImpactPct
                }
            });

            return {
                success: true,
                price: outAmount / inAmount,
                priceImpact: bestRoute.priceImpactPct,
                route: bestRoute,
                minOutputAmount: Number(bestRoute.otherAmountThreshold.toString()),
                tokenData: {
                    input: await this.getTokenInfo(params.inputMint),
                    output: await this.getTokenInfo(params.outputMint)
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Quote error:', error);
            throw error;
        }
    }

    private async submitToBlockEngine(
        signedTransaction: Transaction | VersionedTransaction
    ): Promise<string> {
        try {
            const serializedTx = Buffer.from(
                signedTransaction instanceof VersionedTransaction 
                    ? signedTransaction.serialize()
                    : signedTransaction.serialize({
                        requireAllSignatures: false,
                        verifySignatures: false
                    })
            );

            const response = await fetch(`${this.config.blockEngineUrl}/bundle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transactions: [serializedTx.toString('base64')],
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit to block engine');
            }

            const result = await response.json();
            return result.bundleId;

        } catch (error) {
            console.error('Block engine submission error:', error);
            throw error;
        }
    }

    private async monitorTransaction(bundleId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const interval = setInterval(async () => {
                try {
                    const response = await fetch(
                        `${this.config.blockEngineUrl}/bundle/${bundleId}`
                    );
                    
                    if (!response.ok) {
                        throw new Error('Failed to check bundle status');
                    }

                    const result = await response.json();

                    if (result.status === 'confirmed') {
                        clearInterval(interval);
                        // Notify execution update via WebSocket
                        this.wsHandler.send({
                            type: 'execution_update',
                            data: {
                                tradeId: bundleId,
                                signature: result.signature,
                                status: 'confirmed',
                                slot: result.slot
                            }
                        });
                        resolve(result.signature);
                    } else if (result.status === 'failed') {
                        clearInterval(interval);
                        reject(new Error(result.error || 'Transaction failed'));
                    }

                    attempts++;
                    if (attempts >= this.config.maxRetries) {
                        clearInterval(interval);
                        reject(new Error('Max monitoring attempts reached'));
                    }
                } catch (error) {
                    console.error('Transaction monitoring error:', error);
                    attempts++;
                    if (attempts >= this.config.maxRetries) {
                        clearInterval(interval);
                        reject(error);
                    }
                }
            }, this.config.retryDelay);
        });
    }

    private async getTokenInfo(address: string): Promise<any> {
        // Implement token info fetching logic
        // This could be from Jupiter API, your own token list, etc.
        try {
            const response = await fetch(
                `https://token.jup.ag/all`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch token info');
            }

            const tokens = await response.json();
            return tokens.find((t: any) => t.address === address) || {
                address,
                symbol: address.slice(0, 8),
                decimals: 9
            };
        } catch (error) {
            console.error('Token info fetch error:', error);
            return {
                address,
                symbol: address.slice(0, 8),
                decimals: 9
            };
        }
    }
}