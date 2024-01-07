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
            <div className="cec_v1_footer_sect">
              <div className="container">
                <div className="cec_v1_footer_content">
                  <div className="footer_social_links">
                    <ul>
                      <li className="social_hov_shape_show">
                        <a href="https://www.facebook.com/cryptoelitesclub">
                          <span><img src="https://soulagain.crypto-elites.club/assets/images/icon/facebook.svg" alt="Facebook" /></span>
                        </a>
                        <span className="social_hov_shape1"><img src="https://soulagain.crypto-elites.club/assets/images/icon/S7.svg" alt="Soul Again S logo" /></span>
                      </li>
                      <li className="social_hov_shape_show">
                        <a href="https://magiceden.io/marketplace/fluxsoulagain">
                          <span><img src="https://soulagain.crypto-elites.club/assets/images/icon/MEden.svg" alt="Magic eden" /></span>
                        </a>
                        <span className="social_hov_shape1"><img src="https://soulagain.crypto-elites.club/assets/images/icon/S7.svg" alt="Soul Again S logo" /></span>
                      </li>
                      <li className="social_hov_shape_show">
                        <a href="https://www.sniper.xyz/collection/soul-again">
                          <span><img src="https://soulagain.crypto-elites.club/assets/images/icon/sniper.svg" alt="Sniper" /></span>
                        </a>
                        <span className="social_hov_shape1"><img src="https://soulagain.crypto-elites.club/assets/images/icon/S7.svg" alt="Soul Again S logo" /></span>
                      </li>
                      <li className="social_hov_shape_show">
                        <a href="https://www.tensor.trade/trade/fluxsoulagain">
                          <span><img src="https://soulagain.crypto-elites.club/assets/images/icon/tensor.svg" alt="Tensor" /></span>
                        </a>
                        <span className="social_hov_shape1"><img src="https://soulagain.crypto-elites.club/assets/images/icon/S7.svg" alt="Soul Again S logo" /></span>
                      </li>
                      <li className="social_hov_shape_show">
                        <a href="https://twitter.com/crypto_e_club">
                          <span><img src="https://soulagain.crypto-elites.club/assets/images/icon/Twitter.svg" alt="Twitter" /></span>
                        </a>
                        <span className="social_hov_shape1"><img src="https://soulagain.crypto-elites.club/assets/images/icon/S7.svg" alt="Soul Again S logo" /></span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
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
      <div className="header"{styles.wallet}>
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
