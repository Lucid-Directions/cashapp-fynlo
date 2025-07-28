import React from 'react';

const mockComponent = (name) => {
  return React.forwardRef((props, ref) => {
    const { testID, ...otherProps } = props;
    return React.createElement('Text', {
      ...otherProps,
      ref,
      testID: testID || `mock-${name}`,
      children: name,
    });
  });
};

export const MaterialIcons = mockComponent('MaterialIcons');
export const Ionicons = mockComponent('Ionicons');
export const FontAwesome = mockComponent('FontAwesome');
export const FontAwesome5 = mockComponent('FontAwesome5');
export const AntDesign = mockComponent('AntDesign');
export const Feather = mockComponent('Feather');
export const MaterialCommunityIcons = mockComponent('MaterialCommunityIcons');

export default {
  MaterialIcons,
  Ionicons,
  FontAwesome,
  FontAwesome5,
  AntDesign,
  Feather,
  MaterialCommunityIcons,
};