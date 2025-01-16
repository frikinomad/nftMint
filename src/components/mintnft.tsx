'use client';

import React, { useState, useCallback } from 'react';
import { useMemo } from 'react';
import { Upload, ImagePlus, X, ExternalLink } from 'lucide-react';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SendTransactionError } from '@solana/web3.js';

import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { base58, createGenericFile, generateSigner, percentAmount } from '@metaplex-foundation/umi';
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';


const MintNft: React.FC = () => {
    const [mintAddress, setMintAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { connected, publicKey } = useWallet();
    const wallet = useWallet();

    wallet.connect();


    // Form state
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [description, setDescription] = useState('');
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [solanaExplorerUrl, setSolanaExplorerUrl] = useState('');
    const [metaplexExplorerUrl, setMetaplexExplorerUrl] = useState('');

    // Configure UMI
    const network = useMemo(() => 'https://api.devnet.solana.com', []);
    const umi = useMemo(() => {
        const umiInstance = createUmi(network);
        umiInstance.use(mplTokenMetadata());
        umiInstance.use(mockStorage());
        umiInstance.use(walletAdapterIdentity(wallet))
        return umiInstance;
    }, [network]);


     // NFT details state
     const [nftDetail, setNftDetail] = useState({
        name: "",
        symbol: "",
        uri: "IPFS_URL_OF_METADATA",
        royalties: 5.5,
        description: '',
        imgType: 'image/png',
        attributes: [
            { trait_type: 'Speed', value: 'Quick' },
        ]
    });

    // Handle image selection
    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            // Create preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Update NFT details when form changes
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setNftDetail(prev => ({
            ...prev,
            name,
            symbol,
            description,
        }));
    };

    const uploadImage = async (): Promise<string> => {
        if (!selectedImage) {
            throw new Error('No image selected');
        }

        const formData = new FormData();
        formData.append('file', selectedImage);

        const response = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            const buffer = Buffer.from(data.fileBuffer, 'base64');
            const uint8Array = new Uint8Array(buffer);

            const image = createGenericFile(
                uint8Array,
                selectedImage.name,
                {
                    uniqueName: nftDetail.name,
                    contentType: selectedImage.type
                }
            );
            const [imgUri] = await umi.uploader.upload([image]);
            return imgUri;
        } else {
            throw new Error(data.error);
        }
    };

    const uploadMetadata = async (imageUri: string): Promise<string> => {
        const metadata = {
            name: nftDetail.name,
            description: nftDetail.description,
            image: imageUri,
            attributes: nftDetail.attributes,
            properties: {
                files: [
                    {
                        type: selectedImage?.type || nftDetail.imgType,
                        uri: imageUri,
                    },
                ]
            }
        };
        const metadataUri = await umi.uploader.uploadJson(metadata);
        return metadataUri;
    };

    const mintNft = async (metadataUri: string) => {

        const mint = generateSigner(umi);
        // umi.use(signerIdentity(mint)) - this was causing erros, Idk why I had this in first place
        try {
            const tx = await createNft(umi, {
                mint,
                name: nftDetail.name,
                symbol: nftDetail.symbol,
                uri: metadataUri,
                sellerFeeBasisPoints: percentAmount(nftDetail.royalties),
            }).sendAndConfirm(umi);

            const signature = base58.deserialize(tx.signature)[0]

            const solanaExplorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
            setSolanaExplorerUrl(solanaExplorerUrl);
            const metaplexExplorerUrl = `https://core.metaplex.com/explorer/${mint.publicKey}?env=devnet`;
            setMetaplexExplorerUrl(metaplexExplorerUrl)
        } catch (err) {
            if (err instanceof SendTransactionError) {
                console.error('Transaction Error:', err);
                return 'Transaction error';
            } else {
                console.error('Unknown Error:', err);
                return 'Transaction error';
            }
        }
        return mint.publicKey.toString();
    };

    const handleMintNft = useCallback(async () => {

        if (!publicKey) {
            setError('Wallet not connected');
            return;
        }

        if (!selectedImage) {
            setError('Please select an image');
            return;
        }
        if (!name || !symbol || !description) {
            setError('Please fill in all fields');
            return;
        }

        wallet.connect();

        try {
            const imageUri = await uploadImage();
            console.log("ran imageuri ", imageUri);
            const metadataUri = await uploadMetadata(imageUri);
            console.log("ran metadatauri ", metadataUri);
            const nftMintAddress = await mintNft(metadataUri);
            console.log("ran nftmintaddress ");

            // const nftMintAddress = await completeNftMint();
            // const nftMintAddress = await docNft();
            setMintAddress(nftMintAddress);
            setError(null);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred');
            }
            setMintAddress(null);
        }
    }, [publicKey, umi, name, symbol, description, selectedImage]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-end mb-8">
                <WalletMultiButton />
            </div>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold tracking-tight mb-2">Create Your NFT</h1>
              <p className="text-gray-400">Mint unique digital assets on Solana blockchain</p>
            </div>
    
            {!connected ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
                  <p className="text-gray-400">Please connect your wallet to start minting NFTs</p>
                </div>
                <div className="flex justify-center">
                  <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200">
                    Connect Wallet
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                  <h2 className="text-xl font-semibold mb-2">NFT Details</h2>
                  <p className="text-gray-400">Fill in the details for your new NFT</p>
                </div>
    
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-sm font-medium">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="Enter NFT name"
                    />
                  </div>
    
                  <div className="space-y-2">
                    <label htmlFor="symbol" className="block text-sm font-medium">
                      Symbol
                    </label>
                    <input
                      id="symbol"
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      placeholder="Enter token symbol"
                    />
                  </div>
    
                  <div className="space-y-2">
                    <label htmlFor="description" className="block text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 min-h-[100px] resize-y"
                      placeholder="Describe your NFT"
                    />
                  </div>
    
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Image</label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg p-6 bg-gray-900/30">
                      {imagePreview ? (
                        <div className="relative w-full aspect-square max-w-sm mx-auto">
                          <img
                            src={imagePreview}
                            alt="NFT Preview"
                            className="rounded-lg object-cover w-full h-full"
                          />
                          <button
                            onClick={() => setImagePreview(null)}
                            className="absolute bottom-2 right-2 px-3 py-1 bg-gray-800/90 hover:bg-gray-700/90 rounded-md text-sm flex items-center gap-1 transition-colors duration-200"
                          >
                            <X className="h-4 w-4" />
                            Change
                          </button>
                        </div>
                      ) : (
                        <label className="w-full cursor-pointer">
                          <div className="flex flex-col items-center gap-2">
                            <ImagePlus className="h-12 w-12 text-gray-400" />
                            <span className="text-sm text-gray-400">
                              Click to upload image
                            </span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
    
                <div className="p-6 border-t border-gray-700 space-y-4">
                  <button
                    onClick={handleMintNft}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Mint NFT
                  </button>
                  
                  {mintAddress && (
                    <div className="p-4 bg-green-900/20 rounded-lg">
                        <p className="text-green-400 text-sm text-center">
                            NFT Minted Successfully!
                        </p>
                        <p className="text-xs text-gray-400 mt-1 break-all">
                            {mintAddress}
                        </p>
                        <div className="mt-4 flex flex-col gap-2">
                            {solanaExplorerUrl && (
                            <a
                                href={solanaExplorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
                            >
                                View on Solana Explorer
                                <ExternalLink className="h-4 w-4" />
                            </a>
                            )}
                        </div>
                    </div>
                  )}
    
                  {error && (
                    <div className="p-4 bg-red-900/20 rounded-lg">
                      <p className="text-red-400 text-sm text-center">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
    );
};

export default MintNft;
