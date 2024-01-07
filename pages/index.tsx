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
                    fill="currentColor"
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
                    fill="currentColor"
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
                    fill="currentColor"
                    strokeWidth="0"
                    d="m8.96,15.02c.11-.22.19-.36.24-.5.82-2.02,1.64-4.03,2.46-6.05.44-1.09.96-1.44,2.13-1.45,3.3,0,6.59,0,9.89,0,.82,0,1.41.51,1.48,1.25.07.84-.54,1.5-1.43,1.51-1.72.01-3.44,0-5.16,0-.14,0-.28,0-.42,0l-.04.11c.24.21.49.42.73.63.63.54,1.29,1.06,1.9,1.64.69.66.76,1.65.2,2.42-.13.18-.3.33-.46.47-.72.61-1.45,1.22-2.18,1.82-.06.05-.14.09-.21.14.02.04.03.07.05.11.15.01.3.03.45.03,1.65,0,3.3-.02,4.94.02.37,0,.79.12,1.1.31.5.3.66.93.5,1.47-.18.58-.69.98-1.32,1-.58.02-1.16,0-1.73,0-2.05,0-4.11.01-6.16,0-1.65-.01-2.83-1.55-2.32-3.08.14-.42.44-.83.76-1.14.7-.67,1.47-1.27,2.2-1.91.35-.3.36-.35.02-.65-.91-.79-1.83-1.57-2.74-2.36-.22-.19-.33-.17-.44.12-1,2.62-2,5.24-3.01,7.85-.41,1.07-1.5,1.42-2.3.74-.21-.18-.38-.45-.49-.72-.83-2.08-1.63-4.17-2.44-6.25-.06-.14-.12-.28-.18-.43-.03,0-.06.01-.1.02,0,.14,0,.28,0,.42,0,1.96.01,3.91,0,5.87,0,1.08-1.08,1.81-2.07,1.4-.6-.24-.96-.7-.96-1.36,0-3.11-.01-6.22,0-9.33,0-.95.76-1.8,1.74-2.05.99-.25,2.04.19,2.55,1.11.21.38.36.81.53,1.21.7,1.72,1.4,3.44,2.1,5.16.05.12.11.23.21.44Z"
                  ></path>
                </svg>
              </a>
            
              <a href="https://www.reddit.com/r/cryptoelitesclub/" target="_blank" rel="noopener noreferrer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="#fafafa"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  className="icon icon-tabler icon-tabler-brand-reddit-filled"
                  viewBox="0 0 26 26"
                >
                  <path stroke="none" d="M0 0h24v24H0z"></path>
                  <path
                    fill="currentColor"
                    strokeWidth="0"
                    d="M26.58,13.6c-.04-1.57-1.31-2.86-2.89-2.91-.86-.03-1.65,.32-2.21,.88-1.86-1.33-4.37-2.21-7.17-2.36-.09,0-.16-.09-.14-.18l1.19-5.79c.02-.08,.1-.13,.18-.12l3.89,.82c.09,.02,.15,.09,.16,.18,.11,1.06,1.01,1.89,2.1,1.88,1.1-.01,2.02-.9,2.06-2,.05-1.19-.91-2.17-2.08-2.17-.78,0-1.47,.43-1.82,1.07-.03,.05-.09,.08-.15,.07l-4.59-.97s-.07-.01-.11-.01c-.27-.02-.52,.16-.57,.43l-1.36,6.59c-.02,.11-.11,.18-.22,.19-2.9,.1-5.5,.97-7.43,2.33-.55-.5-1.28-.79-2.08-.77-1.59,.04-2.88,1.34-2.9,2.92-.02,1.22,.68,2.27,1.71,2.75-.03,.25-.05,.5-.05,.76,0,4.42,5.07,8,11.32,8s11.32-3.58,11.32-8c0-.25-.02-.49-.05-.74,1.13-.44,1.92-1.55,1.89-2.85ZM6.46,15.65c0-1.32,1.07-2.38,2.38-2.38s2.38,1.07,2.38,2.38-1.07,2.38-2.38,2.38-2.38-1.07-2.38-2.38Zm11.5,5.69c-1.37,.96-2.59,1.3-4.39,1.3h0c-1.8,0-3.01-.34-4.38-1.3-.19-.13-.51-.51-.55-.81l.02-.03c.13-.18,.38-.17,.57-.09,1.4,.61,2.74,1.38,4.34,1.39,1.6-.01,2.94-.78,4.33-1.39,.2-.09,.44-.09,.57,.09l.02,.03c-.04,.3-.36,.68-.55,.81Zm.01-3.31c-1.32,0-2.38-1.07-2.38-2.38s1.07-2.38,2.38-2.38,2.38,1.07,2.38,2.38-1.07,2.38-2.38,2.38Z"
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
                    fill="currentColor"
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
