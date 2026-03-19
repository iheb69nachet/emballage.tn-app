import { useWindowDimensions } from 'react-native';

export const useR = () => {
  const { width, height } = useWindowDimensions();
  const isFold = width >= 600;
  const px = isFold ? 24 : 16;
  const cardW = (width - px * 2 - 12) / (isFold ? 2 : 1);
  return { width, height, isFold, px, cardW };
};
