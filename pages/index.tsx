import {
  PublicKey,
  publicKey,
  Umi,
} from "@metaplex-foundation/umi";
import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import dynamic from "next/dynamic";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { useUmi } from "../utils/useUmi";
import { fetchCandyMachine, safeFetchCandyGuard, CandyGuard, CandyMachine } from "@metaplex-foundation/mpl-candy-machine"
import styles from "../styles/Home.module.css";
import { guardChecker } from "../utils/checkAllowed";
import { Center, Card, CardHeader, CardBody, StackDivider, Heading, Stack, useToast, Text, Skeleton, useDisclosure, Button, Modal, ModalBody, ModalCloseButton, ModalContent, Image, ModalHeader, ModalOverlay, Box, Divider, VStack, Flex } from '@chakra-ui/react';
import { ButtonList } from "../components/mintButton";
import { GuardReturn } from "../utils/checkerHelper";
import { ShowNft } from "../components/showNft";
import { InitializeModal } from "../components/initializeModal";
import { image, headerText } from "../settings";
import { useSolanaTime } from "@/utils/SolanaTimeContext";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const useCandyMachine = (umi: Umi, candyMachineId: string, checkEligibility: boolean, setCheckEligibility: Dispatch<SetStateAction<boolean>>) => {
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<CandyGuard>();
  const toast = useToast();


  useEffect(() => {
    (async () => {
      if (checkEligibility) {
        if (!candyMachineId) {
          console.error("No candy machine in .env!");
          if (!toast.isActive("no-cm")) {
            toast({
              id: "no-cm",
              title: "No candy machine in .env!",
              description: "Add your candy machine address to the .env file!",
              status: "error",
              duration: 999999,
              isClosable: true,
            });
          }
          return;
        }

        let candyMachine;
        try {
          candyMachine = await fetchCandyMachine(umi, publicKey(candyMachineId));
        } catch (e) {
          console.error(e);
          toast({
            id: "no-cm-found",
            title: "The CM from .env is invalid",
            description: "Are you using the correct environment?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        setCandyMachine(candyMachine);
        if (!candyMachine) {
          return;
        }
        let candyGuard;
        try {
          candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
        } catch (e) {
          console.error(e);
          toast({
            id: "no-guard-found",
            title: "No Candy Guard found!",
            description: "Do you have one assigned?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        if (!candyGuard) {
          return;
        }
        setCandyGuard(candyGuard);
        setCheckEligibility(false)
      }
    })();
  }, [umi, checkEligibility]);

  return { candyMachine, candyGuard };


};


export default function Home() {
  const umi = useUmi();
  const solanaTime = useSolanaTime();
  const toast = useToast();
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();
  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey, offChainMetadata: JsonMetadata | undefined }[] | undefined>();
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [guards, setGuards] = useState<GuardReturn[]>([
    { label: "startDefault", allowed: false, maxAmount: 0 },
  ]);
  const [checkEligibility, setCheckEligibility] = useState<boolean>(true);


  if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
    console.error("No candy machine in .env!")
    if (!toast.isActive('no-cm')) {
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
    }
  }
  const candyMachineId: PublicKey = useMemo(() => {
    if (process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
    } else {
      console.error(`NO CANDY MACHINE IN .env FILE DEFINED!`);
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
      return publicKey("11111111111111111111111111111111");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { candyMachine, candyGuard } = useCandyMachine(umi, candyMachineId, checkEligibility, setCheckEligibility);

  useEffect(() => {
    const checkEligibility = async () => {
      if (candyMachine === undefined || !candyGuard || !checkEligibility) {
        return;
      }

      const { guardReturn, ownedTokens } = await guardChecker(
        umi, candyGuard, candyMachine, solanaTime
      );

      setOwnedTokens(ownedTokens);
      setGuards(guardReturn);
      setIsAllowed(false);

      let allowed = false;
      for (const guard of guardReturn) {
        if (guard.allowed) {
          allowed = true;
          break;
        }
      }

      setIsAllowed(allowed);
      setLoading(false);
    };

    checkEligibility();
    // On purpose: not check for candyMachine, candyGuard, solanaTime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umi, checkEligibility]);

  const PageContent = () => {
    return (
      <>
        <style jsx global>
          {`
            body {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 48px;
              min-height: 100vh;
              background-color: #fbf3e2;
              color: #02395d;
              font-size: 20px;
              line-height: 1.45;
              margin: 0;
              background-image: url(https://soulagain.crypto-elites.club/assets/images/bg/spiral2.gif);
              background-repeat: no-repeat;
              background-size: cover;
              background-position: 50% 50%;
              font-family: acier-bat-solid, sans-serif;
            }
            main {
              height: 100vh;
              width: 100vw;
            }
   `}
        </style>
        <Card >
          <CardHeader backgroundColor='#fbf3e2'>
            <Flex minWidth='max-content' flexDirection='column-reverse' alignItems='center' gap='2'>
              <Box>
                <Heading color= '#02395d' fontFamily='acier-bat-solid' size='md'>{headerText}</Heading>
              </Box>
              {loading ? (<></>) : (
                <Flex justifyContent="flex-end" >
                  <Box background={"teal.100"} borderRadius={"5px"} minWidth={"50px"} p={2} >
                    <VStack >
                      <Text color= '#02395d' fontFamily='acier-bat-solid' fontWeight={"semibold"}>Available NFTs: {Number(candyMachine?.data.itemsAvailable) - Number(candyMachine?.itemsRedeemed)}/{Number(candyMachine?.data.itemsAvailable)}</Text>
                    </VStack>
                  </Box>
                </Flex>
              )}
            </Flex>
          </CardHeader>

          <CardBody backgroundColor='#fbf3e2'>
            <Center>
              <Box
                rounded={'lg'}
                mt={-12}
                pos={'relative'}>
                <Image
                  rounded={'lg'}
                  height={230}
                  objectFit={'cover'}
                  alt={"project Image"}
                  src={'https://soulagain.crypto-elites.club/assets/images/nft/character1.gif'}
                />
              </Box>
            </Center>
            <div className="social-container">
              <a href="https://discord.gg/cryptoelitesclub" target="_blank" rel="noopener noreferrer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="#fafafa"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  className="icon icon-tabler icon-tabler-brand-discord-filled"
                  viewBox="0 0 24 24"
                >
                  <path stroke="none" d="M0 0h24v24H0z"></path>
                  <path
                    fill="#02395d"
                    strokeWidth="0"
                    d="M14.983 3l.123.006c2.014.214 3.527.672 4.966 1.673a1 1 0 01.371.488c1.876 5.315 2.373 9.987 1.451 12.28C20.891 19.452 19.288 21 17.5 21c-.94 0-2.257-1.596-2.777-2.969l-.02.005c.838-.131 1.69-.323 2.572-.574a1 1 0 10-.55-1.924c-3.32.95-6.13.95-9.45 0a1 1 0 00-.55 1.924c.725.207 1.431.373 2.126.499l.444.074C8.818 19.405 7.6 21 6.668 21c-1.743 0-3.276-1.555-4.267-3.644-.841-2.206-.369-6.868 1.414-12.174a1 1 0 01.358-.49C5.565 3.676 6.98 3.217 8.89 3.007a1 1 0 01.938.435l.063.107.652 1.288.16-.019c.877-.09 1.718-.09 2.595 0l.158.019.65-1.287a1 1 0 01.754-.54l.123-.01zM9 9a2 2 0 00-1.977 1.697l-.018.154L7 11l.005.15A2 2 0 109 9zm6 0a2 2 0 00-1.977 1.697l-.018.154L13 11l.005.15A2 2 0 1015 9z"
                  ></path>
                </svg>
              </a>

              <a href="https://www.facebook.com/cryptoelitesclub" target="_blank" rel="noopener noreferrer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="#fafafa"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  className="icon icon-tabler icon-tabler-brand-facebook-filled"
                  viewBox="0 0 26 26"
                >
                  <path stroke="none" d="M0 0h24v24H0z"></path>
                  <path
                    fill="#02395d"
                    strokeWidth="0"
                    d="M15.26,25.05c5.64-.81,9.87-5.62,9.87-11.48,0-6.42-5.21-11.63-11.63-11.63S1.87,7.15,1.87,13.57c0,5.83,4.14,10.62,9.74,11.47h-.01c0-2.71,.01-5.39,.01-8.1h-2.99c0-1.13,.02-2.25,.03-3.38h2.97c0-.48-.16-3.02,.33-4.53,.76-2.31,3.37-3.01,6.65-2.31,0,.95,.02,1.9,.03,2.86-2.83,.08-3.6-.18-3.35,4.07,1.05,0,2.19-.05,3.24-.05-.16,1.13-.33,2.26-.49,3.39l-2.76,.04c.01,2.68,.03,5.36,.04,8.04"
                  ></path>
                </svg>
              </a>
                          
              <a href="https://magiceden.io/marketplace/fluxsoulagain" target="_blank" rel="noopener noreferrer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="#fafafa"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  className="icon icon-tabler icon-tabler-brand-magic-eden-filled"
                  viewBox="0 0 24 24"
                >
                  <path stroke="none" d="M0 0h24v24H0z"></path>
                  <path
                    fill="#02395d"
                    strokeWidth="0"
                    d="m8.96,15.02c.11-.22.19-.36.24-.5.82-2.02,1.64-4.03,2.46-6.05.44-1.09.96-1.44,2.13-1.45,3.3,0,6.59,0,9.89,0,.82,0,1.41.51,1.48,1.25.07.84-.54,1.5-1.43,1.51-1.72.01-3.44,0-5.16,0-.14,0-.28,0-.42,0l-.04.11c.24.21.49.42.73.63.63.54,1.29,1.06,1.9,1.64.69.66.76,1.65.2,2.42-.13.18-.3.33-.46.47-.72.61-1.45,1.22-2.18,1.82-.06.05-.14.09-.21.14.02.04.03.07.05.11.15.01.3.03.45.03,1.65,0,3.3-.02,4.94.02.37,0,.79.12,1.1.31.5.3.66.93.5,1.47-.18.58-.69.98-1.32,1-.58.02-1.16,0-1.73,0-2.05,0-4.11.01-6.16,0-1.65-.01-2.83-1.55-2.32-3.08.14-.42.44-.83.76-1.14.7-.67,1.47-1.27,2.2-1.91.35-.3.36-.35.02-.65-.91-.79-1.83-1.57-2.74-2.36-.22-.19-.33-.17-.44.12-1,2.62-2,5.24-3.01,7.85-.41,1.07-1.5,1.42-2.3.74-.21-.18-.38-.45-.49-.72-.83-2.08-1.63-4.17-2.44-6.25-.06-.14-.12-.28-.18-.43-.03,0-.06.01-.1.02,0,.14,0,.28,0,.42,0,1.96.01,3.91,0,5.87,0,1.08-1.08,1.81-2.07,1.4-.6-.24-.96-.7-.96-1.36,0-3.11-.01-6.22,0-9.33,0-.95.76-1.8,1.74-2.05.99-.25,2.04.19,2.55,1.11.21.38.36.81.53,1.21.7,1.72,1.4,3.44,2.1,5.16.05.12.11.23.21.44Z"
                  ></path>
                </svg>
              </a>
            
              <a href="https://www.sniper.xyz/collection/soul-again" target="_blank" rel="noopener noreferrer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="#fafafa"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  className="icon icon-tabler icon-tabler-brand-sniper-filled"
                  viewBox="0 0 26 26"
                >
                  <path stroke="none" d="M0 0h24v24H0z"></path>
                  <path
                    fill="#02395d"
                    strokeWidth="0"
                    d="m924.06,478.78c-9.97-15.02-24.7-20.07-41.84-20.08-91.65-.02-183.29-.03-274.94-.05-6.42-15.91-15.46-30.07-28.02-41.87-19.21-18.04-41.7-28.84-68.16-30.83h0c-9.83-1.15-19.61-1.26-29.31,1.1-8.63.87-16.84,3.22-24.64,7.01-6.37,2.24-12.47,4.99-17.75,9.31,0,0,0,0,0,0-5.89,2.89-10.93,6.9-15.36,11.69-6.1,5.15-11.69,10.78-15.83,17.69,0-.01.02-.02.03-.03,0,0-.02.02-.03.03-4.04,4.99-7.64,10.24-9.66,16.41-1.72,1.49-2.25,3.64-2.91,5.64-1.03,3.09-2.94,3.98-6.14,3.97-44.24-.11-88.49-.13-132.73-.02-3.83.01-5.37-1.1-4.75-4.88h0c.26-.34.32-.7.17-1.1,1.01-1.45,1.06-3.1.98-4.77.26-.34.32-.7.18-1.1,1.53-6.21,3.06-12.42,4.6-18.63.27-.4.37-.84.43-1.28,2.61-7.72,5.22-15.44,7.83-23.16,0,0,0-.01.01-.02,2.6-4.07,4.22-8.57,5.78-13.09h0c5.57-10.17,11.13-20.33,16.7-30.5,3.45-4.98,6.9-9.96,10.36-14.94,0,0,0,0,0,0,3.09-3.04,5.66-6.48,7.99-10.12h0c4.73-5.32,9.46-10.63,14.2-15.95,0,0,0,0,0,0,4.65-4.42,9.31-8.84,13.96-13.26,0,0,0,0,0,0,4.31-3.54,8.63-7.07,12.94-10.61,1.57-.64,2.83-1.63,3.68-3.12.02.02.05.04.07.06,6.02-2.74,10.32-8,16.17-10.99,5.09-3.11,10.19-6.22,15.28-9.33,6.45-1.5,11.4-6.16,17.55-8.29h0c6.65-2.69,13.3-5.37,19.96-8.06h0c9.76-2.76,19.53-5.52,29.29-8.28,9.38-1.57,18.76-3.14,28.14-4.7h0c6.29-.41,12.58-.83,18.86-1.24,0,0,0,0,0,0,12.22.32,24.48-.32,36.64,1.39,8.79,1.23,17.58,2.45,26.37,3.68,17.19,4.4,34.09,9.69,50.56,16.31.98.6,1.91,1.32,2.95,1.78,18.05,8.01,34.72,18.31,50.46,30.19,16.25,12.26,30.15,26.92,43.64,42.03,2.26,4.33,5.56,7.9,8.77,11.49,9.28,10.39,20.72,15.91,34.87,15.13,0,0,0,0,0,0,0,0,0,0,0,0,5,.32,9.7-.77,14.13-3.1,0,0,0,0,0,0,4.72-.95,8.52-3.48,11.81-6.88,5.13-3.12,8.43-7.74,10.74-13.16,0,0,0,0,0,0,1.66-2.12,2.85-4.45,3.17-7.16,0,0,0,0,0,0h0c.21-.34.27-.7.2-1.09,0,0,0,0,0,0,1.24-1.38,1.21-3.05,1.1-4.74,3.21-12.68-.31-24-7.83-34.02-27.92-37.23-61.76-67.98-101.96-91.55-19.51-11.44-39.67-21.57-61.39-28.26h0c-16.29-6.53-33.19-10.78-50.45-13.73,0,0,0,0,0,0-5-1.4-10.06-2.4-15.27-2.45h0c-2.36-.36-4.92.45-7.07-1.2,0,0,0,0,0,0h0c-1.62-2.57-.62-5.51-1.18-8.23,0-8.21,0-16.42,0-24.62.03-9.52,1.19-19.1-1.18-28.51-5.46-21.75-29.15-36.81-49.11-31.72-.47.02-.97.12-1.5.36-12.03,1.49-20.86,8-27.67,17.67,0,0,0,0,0,0-3.15,3.77-5.21,8.05-6.07,12.9h0c-.2.35-.26.72-.17,1.11-1.28,1.38-1.11,3.08-1.06,4.75h0c-.17.37-.19.74-.07,1.13h0c-1.26,1.72-.91,3.72-.91,5.63,0,16.51.02,33.01.04,49.52h0c-2.91,2.14-6.8.15-9.71,2.3,0,0,0,0,0,0-11.17,1.16-22.04,3.7-32.73,7.07-8.89,1.89-17.58,4.4-25.89,8.15,0,0,0,0,0,0-7.33,1.92-14.31,4.69-21,8.23h0c-10.73,4.09-21.16,8.77-30.76,15.16-5.13,1.99-9.76,4.86-14.12,8.18,0,0,0,0,0,0-5.72,3.05-11.33,6.27-16.16,10.67,0,0,0,0,0,0-5.19,2.89-9.98,6.33-14.22,10.49,0,0,0,0,0,0-5.26,3.26-9.92,7.25-14.26,11.63-4.85,3.31-8.98,7.41-12.87,11.77-5.55,4.57-10.64,9.58-15.02,15.31,0,0,0,0,0,0-4.88,4.1-8.73,9.11-12.52,14.17-3.73,3.93-7.29,7.99-9.93,12.76,0,0,0,0,0,0-3.99,4.29-7.43,8.97-10.12,14.19-5.5,6.88-9.96,14.41-13.92,22.25-3.29,4.78-6,9.88-8.22,15.25,0,0,0,0,0,0h0c-4.37,7.87-8.47,15.86-11.07,24.53,0,0,0,0,0,0-4.44,9.03-7.93,18.41-10.25,28.22-3.21,8.36-5.72,16.91-7.02,25.79-3.02,10.76-5.08,21.69-5.91,32.84h0c-.56,3.56-3.01,3.75-5.98,3.73-14.6-.11-29.19-.08-43.79-.03-2.28,0-4.69-.59-6.81.87,0,0,0,0,0,0-7.89.32-14.6,3.59-20.69,8.35h0s0,0,0,0c-7.68,6.12-13.56,13.43-15.36,23.41-2,4.27-1.27,8.83-1.27,13.28.03,21.94,18.05,40.93,40.02,41.85,9.74.41,19.52-.02,29.28-.07h50.42c12.9,0,25.8,0,38.69,0h0s0,0,0,0c10.95,0,21.89,0,32.84,0h0c11.72,0,23.44,0,35.16,0h0c14.07,0,28.15,0,42.22,0,12.89,0,25.79,0,38.68,0h0c6.25.04,12.5.08,18.75.13,3.62,5.74,5.91,12.28,10.61,17.36,3.68,6.97,9.08,12.58,14.7,17.91,15.97,15.15,34.44,25.65,56.41,29.33,0,0,0,0,0,0,10.13,2.79,20.42,3.41,30.83,2.12,8.93.11,17.45-1.96,25.84-4.78h0c5.39-1.17,10.42-3.26,15.2-5.96,4.61-1.12,7.68-4.85,11.73-6.92h0c6.63-2.64,11.57-7.53,16.57-12.35,6.03-5.21,11.46-10.94,15.51-17.87,0,0,0,0,0,0,2.54-2.33,4.16-5.27,5.43-8.43h0c.86-1.27,2.05-2.44,2.51-3.84,1.71-5.2,4.98-7.15,10.5-6.58,4.61.48,9.31-.03,13.98-.1,9.38,0,18.75,0,28.13,0,0,0,0,0,0,0,0,0,0,0,0,0,10.16,0,20.32,0,30.48,0,9.77,0,19.55,0,29.33,0,11.33,0,22.66,0,33.99,0h0s0,0,0,0c3.47.07,6.94.29,10.4.17,3.26-.12,3.98,1.17,3.31,4.2-1.59,7.14-2.95,14.32-4.41,21.49-2.36,7.42-4.73,14.85-7.09,22.27-1.45,3.52-2.91,7.04-4.36,10.56-1.98,4.3-3.95,8.6-5.93,12.89-2.73,5.09-5.47,10.18-8.2,15.28h0c-3.5,5.47-6.99,10.94-10.49,16.41,0,0,0,0,0,0-3.88,5.07-7.75,10.14-11.63,15.21,0,0,0,0,0,0,0,0,0,0,0,0-3.07,3.38-6.5,6.45-8.91,10.4,0,0,0,0,0,0-6.05,5.93-12.09,11.86-18.14,17.79-5.19,4.27-10.38,8.53-15.57,12.8,0,0,0,0,0,0-7.5,5.05-15,10.09-22.5,15.14-6.54,3.56-13.09,7.12-19.63,10.68h0c-6.25,2.74-12.51,5.47-18.76,8.21-5.46,1.96-10.92,3.91-16.38,5.87,0,0,0,0,0,0-8.31,2.2-16.63,4.4-24.94,6.6-.4.07-.8.16-1.22.32-9.51,1.41-19.03,2.82-28.54,4.23-.99-.01-2.03.13-3.13.46-8.08.31-16.2-.38-24.22,1.13t0,0c-15.64-1.2-31.34-1.79-46.85-4.33-4.93-1.15-9.84-2.32-14.78-3.43-18.9-4.27-36.68-11.69-54.35-19.39,0,0,0,0,0,0-9.36-5.58-18.87-10.94-28.05-16.8-15.86-10.12-29.71-22.73-43.17-35.78-7.05-8.35-13.77-17.01-21.24-24.96-8.5-9.05-19.14-13.94-31.88-13.35-5.71.05-11.18,1.26-16.45,3.46-9.55,3.36-16.53,9.7-21.35,18.51-5.65,9.69-7.42,19.95-4.57,30.89,1.09,2.55.52,5.62,2.48,7.89.39,2.36,1.52,4.34,3.17,6.04,0,0,0,0,0,0,.14.98.59,1.74,1.52,2.17.47.84.85,1.75,1.43,2.5,27.55,35.52,60.69,64.7,99.59,87.22,12.73,7.37,25.59,14.6,39.63,19.35,11.7,5.45,23.73,10,36.34,12.9,14.71,5.21,29.98,8.06,45.35,10.25,4.8.68,5.53,2.58,5.45,6.7-.22,11.1-.2,22.2-.04,33.3.08,5.61-.86,11.28.76,16.82,0,0,0,0,0,0,.35,24.04,28.09,43.5,52.91,37.1,8.36-1.44,15.35-5.37,21.06-11.62,5.66-4.64,8.83-10.75,10.52-17.74h0c1.5-1.01,1.39-2.56,1.36-4.09,0,0,0,0,0,0,1.59-3.3,1.28-6.85,1.29-10.33.04-14.43.1-28.86-.07-43.28-.04-3.6.9-5.23,4.8-5.51,5.02-.37,9.98-1.54,14.96-2.36,11.16-1.27,22.07-3.7,32.78-7.06,8.08-1.5,15.84-4.04,23.47-7.04,8.48-2.39,16.66-5.54,24.57-9.4,6.7-2.23,12.93-5.4,18.79-9.32h0c5.92-1.15,10.6-4.63,15.26-8.15h0c6.28-1.69,11.15-5.86,16.41-9.34,7.12-3.98,13.78-8.63,19.97-13.93h0c5.51-3.42,10.51-7.49,15.15-12.01h0s0,0,0,0c6-4.41,11.56-9.32,16.52-14.89h0c6.88-6,13.31-12.45,18.85-19.73,4.52-4.16,8.33-8.91,11.73-14.01,4.92-5.55,9.51-11.34,13.08-17.88,0,0,0,0,0,0,2.05-1.89,3.67-4.06,4.5-6.77,0,0,0,0,0,0,5.69-7.34,10.27-15.35,14.17-23.75,0,0,0,0,0,0,3.4-5.14,6.09-10.63,8.2-16.42,0,0,0,0,0,0,1.25-1.3,1.89-2.88,2.17-4.63,0,0,0,0,0,0,4.49-8.64,8.2-17.59,10.74-27.01,0,0,0,0,0,0,3.12-7.2,5.61-14.59,6.92-22.35,0,0,0,0,0,0,1.83-4.52,3.33-9.12,3.52-14.05h0c2.17-5.67,3.17-11.56,3.5-17.59,0,0,0,0,0,0,1.73-4.37,1.93-9.02,2.39-13.61.37-3.69,1.8-5.4,5.86-5.19,5.78.3,11.6-.04,17.4-.1h0c10.28-.17,20.8,2.03,30.56-3.14,6.73-2.2,12.2-6.16,16.42-11.84,7.55-7.49,10.65-16.7,10.42-27.17.96-9.35-1.57-17.76-6.72-25.51Z"
                  ></path>
                </svg>
              </a>
 
              <a href="https://twitter.com/crypto_e_club" target="_blank" rel="noopener noreferrer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="#fafafa"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  className="icon icon-tabler icon-tabler-brand-twitter-filled"
                  viewBox="0 0 24 24"
                >
                  <path stroke="none" d="M0 0h24v24H0z"></path>
                  <path
                    fill="#02395d"
                    strokeWidth="0"
                    d="m13.79,10L22.36.04h-2.03l-7.44,8.65L6.95.04H.1l8.99,13.08L.1,23.57h2.03l7.86-9.13,6.28,9.13h6.85l-9.32-13.56h0Zm-2.78,3.23l-.91-1.3L2.86,1.57h3.12l5.85,8.36.91,1.3,7.6,10.87h-3.12l-6.2-8.87h0Z"
                  ></path>
                </svg>
              </a>
            </div>
            <Stack divider={<StackDivider />} spacing='8'>
              {loading ? (
                <div>
                  <Divider my="10px" />
                  <Skeleton height="30px" my="10px" />
                  <Skeleton height="30px" my="10px" />
                  <Skeleton height="30px" my="10px" />
                </div>
              ) : (
                <ButtonList
                  guardList={guards}
                  candyMachine={candyMachine}
                  candyGuard={candyGuard}
                  umi={umi}
                  ownedTokens={ownedTokens}
                  toast={toast}
                  setGuardList={setGuards}
                  mintsCreated={mintsCreated}
                  setMintsCreated={setMintsCreated}
                  onOpen={onShowNftOpen}
                  setCheckEligibility={setCheckEligibility}
                />
              )}
            </Stack>
          </CardBody>
        </Card >
        {umi.identity.publicKey === candyMachine?.authority ? (
          <>
            <Center>
              <Button backgroundColor={"red.200"} marginTop={"10"} onClick={onInitializerOpen}>Initialize Everything!</Button>
            </Center>
            <Modal isOpen={isInitializerOpen} onClose={onInitializerClose}>
              <ModalOverlay />
              <ModalContent maxW="600px">
                <ModalHeader>Initializer</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  < InitializeModal umi={umi} candyMachine={candyMachine} candyGuard={candyGuard} toast={toast} />
                </ModalBody>
              </ModalContent>
            </Modal>

          </>)
          :
          (<></>)
        }

        <Modal isOpen={isShowNftOpen} onClose={onShowNftClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Your minted NFT:</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <ShowNft nfts={mintsCreated} />
            </ModalBody>
          </ModalContent>
        </Modal>
      </>
    );
  };

  return (
    <main>
      <div className={styles.wallet}>
        <div className="h-cont">
          <div className="left-sect">
            <a href="https://soulagain.crypto-elites.club/">
              <img className="logo" src="https://soulagain.crypto-elites.club/assets/images/logoC.svg"/>
            </a>
            <a href="https://runonflux.io/fluxlabs.html">
              <img className="logo-flux" src="https://soulagain.crypto-elites.club/assets/images/icon/flux_labs.svg"/>
            </a>
          </div>
          <a href="https://soulagain.crypto-elites.club/" className="Navhome">
            Home
          </a>
          <WalletMultiButtonDynamic/>
        </div>
        
      </div>

      <div className={styles.center}>
        <PageContent key="content" />
      </div>
      <div className="footer">
        <p>2023 CEC</p>
      </div>
    </main>
  );
}
