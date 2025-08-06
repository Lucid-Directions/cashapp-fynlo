import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CartIcon from '../CartIcon';

describe('CartIcon', () => {
  it('should render cart icon with count', () => {
    const { getByText } = render(<CartIcon count={5} onPress={jest.fn()} />);
    expect(getByText('5')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<CartIcon count={0} onPress={onPress} testID="cart-icon" />);
    
    fireEvent.press(getByTestId('cart-icon'));
    expect(onPress).toHaveBeenCalled();
  });

  it('should not show count when zero', () => {
    const { queryByText } = render(<CartIcon count={0} onPress={jest.fn()} />);
    expect(queryByText('0')).toBeNull();
  });
});
