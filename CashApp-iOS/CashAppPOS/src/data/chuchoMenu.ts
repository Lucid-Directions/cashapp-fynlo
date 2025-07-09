/**
 * Chucho Restaurant Menu Data
 * Based on actual restaurant menu
 */

export const CHUCHO_MENU_ITEMS = [
  // SNACKS
  { id: 1, name: 'Nachos', price: 5.00, category: 'Snacks', description: 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander', image: '🍲', available: true },
  { id: 2, name: 'Quesadillas', price: 5.50, category: 'Snacks', description: 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander', image: '🧀', available: true },
  { id: 3, name: 'Chorizo Quesadilla', price: 5.50, category: 'Snacks', description: 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander', image: '🧀', available: true },
  { id: 4, name: 'Chicken Quesadilla', price: 5.50, category: 'Snacks', description: 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander', image: '🧀', available: true },
  { id: 5, name: 'Tostada', price: 6.50, category: 'Snacks', description: 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta', image: '🍲', available: true },

  // TACOS (All £3.50 each or 3 for £9)
  { id: 6, name: 'Carnitas', price: 3.50, category: 'Tacos', description: 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander', image: '🌮', available: true },
  { id: 7, name: 'Cochinita', price: 3.50, category: 'Tacos', description: 'Marinated pulled pork served with pickle red onion', image: '🌮', available: true },
  { id: 8, name: 'Barbacoa de Res', price: 3.50, category: 'Tacos', description: 'Juicy pulled beef topped with onion, guacamole & coriander', image: '🌮', available: true },
  { id: 9, name: 'Chorizo', price: 3.50, category: 'Tacos', description: 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole', image: '🌮', available: true },
  { id: 10, name: 'Rellena', price: 3.50, category: 'Tacos', description: 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion', image: '🌮', available: true },
  { id: 11, name: 'Chicken Fajita', price: 3.50, category: 'Tacos', description: 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander', image: '🌮', available: true },
  { id: 12, name: 'Haggis', price: 3.50, category: 'Tacos', description: 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion', image: '🌮', available: true },
  { id: 13, name: 'Pescado', price: 3.50, category: 'Tacos', description: 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa', image: '🌮', available: true },
  { id: 14, name: 'Dorados', price: 3.50, category: 'Tacos', description: 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta', image: '🌮', available: true },
  { id: 15, name: 'Dorados Papa', price: 3.50, category: 'Tacos', description: 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta', image: '🌮', available: true },
  { id: 16, name: 'Nopal', price: 3.50, category: 'Tacos', description: 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta', image: '🌮', available: true },
  { id: 17, name: 'Frijol', price: 3.50, category: 'Tacos', description: 'Black beans with fried plantain served with tomato salsa, feta & coriander', image: '🌮', available: true },
  { id: 18, name: 'Verde', price: 3.50, category: 'Tacos', description: 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta', image: '🌮', available: true },
  { id: 19, name: 'Fajita', price: 3.50, category: 'Tacos', description: 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander', image: '🌮', available: true },

  // SPECIAL TACOS (All £4.50 each)
  { id: 20, name: 'Carne Asada', price: 4.50, category: 'Special Tacos', description: 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander', image: '🥩', available: true },
  { id: 21, name: 'Camaron', price: 4.50, category: 'Special Tacos', description: 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole', image: '🍤', available: true },
  { id: 22, name: 'Pulpos', price: 4.50, category: 'Special Tacos', description: 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander', image: '🐙', available: true },

  // BURRITOS
  { id: 23, name: 'Regular Burrito', price: 8.00, category: 'Burritos', description: 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander', image: '🌯', available: true },
  { id: 24, name: 'Special Burrito', price: 10.00, category: 'Burritos', description: 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander', image: '🌯', available: true },
  { id: 25, name: 'Add Mozzarella', price: 1.00, category: 'Burritos', description: 'Add extra cheese to any burrito', image: '🧀', available: true },

  // SIDES & SALSAS
  { id: 26, name: 'Skinny Fries', price: 3.50, category: 'Sides', description: 'Thin cut fries', image: '🍟', available: true },
  { id: 27, name: 'Pico de gallo', price: 0.00, category: 'Sides', description: 'Diced tomato, onion and chilli - FREE', image: '🍅', available: true },
  { id: 28, name: 'Green Chili', price: 0.00, category: 'Sides', description: 'Homemade green chili salsa - HOT! - FREE', image: '🌶️', available: true },
  { id: 29, name: 'Pineapple Habanero', price: 0.00, category: 'Sides', description: 'Pineapple sauce with habanero chili - HOT! - FREE', image: '🍍', available: true },
  { id: 30, name: 'Scotch Bonnet', price: 0.00, category: 'Sides', description: 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE', image: '🔥', available: true },

  // DRINKS
  { id: 31, name: 'Pink Paloma', price: 3.75, category: 'Drinks', description: 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine', image: '🍹', available: true },
  { id: 32, name: 'Coco-Nought', price: 3.75, category: 'Drinks', description: 'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!', image: '🥥', available: true },
  { id: 33, name: 'Corona', price: 3.80, category: 'Drinks', description: 'Mexican beer', image: '🍺', available: true },
  { id: 34, name: 'Modelo', price: 4.00, category: 'Drinks', description: 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml', image: '🍺', available: true },
  { id: 35, name: 'Pacifico', price: 4.00, category: 'Drinks', description: 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml', image: '🍺', available: true },
  { id: 36, name: 'Dos Equis', price: 4.00, category: 'Drinks', description: 'Two X\'s. German brewing heritage with the spirit of Mexican traditions. 355ml', image: '🍺', available: true }
];

export const CHUCHO_CATEGORIES = [
  { id: 1, name: 'All', icon: 'restaurant-menu' },
  { id: 2, name: 'Snacks', icon: 'restaurant' },
  { id: 3, name: 'Tacos', icon: 'local-offer' },
  { id: 4, name: 'Special Tacos', icon: 'star' },
  { id: 5, name: 'Burritos', icon: 'wrap-text' },
  { id: 6, name: 'Sides', icon: 'restaurant-menu' },
  { id: 7, name: 'Drinks', icon: 'local-drink' }
];