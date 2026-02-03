import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

import { 
  Container, Typography, TextField, Button, Card, CardContent, 
  IconButton, Box, AppBar, Toolbar, Chip,
  Tabs, Tab, Badge, Grid, Select, MenuItem, InputLabel, FormControl,
  List, ListItem, ListItemText, Divider, Paper
} from '@mui/material'

import { 
  Add, Remove, Delete, ShoppingCart, Inventory, CheckCircle, Storefront
} from '@mui/icons-material'

function App() {
  const [items, setItems] = useState([]) 
  const [shops, setShops] = useState([]) // Список магазинов
  const [loading, setLoading] = useState(true)
  
  // Состояния для формы добавления
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('шт') 
  const [newItemShop, setNewItemShop] = useState('') // Выбранный магазин при создании

  const [tabIndex, setTabIndex] = useState(0)

  useEffect(() => { 
      fetchData() 
  }, [])

  async function fetchData() {
    setLoading(true)
    // 1. Загружаем товары
    const { data: itemsData } = await supabase
      .from('inventory_items')
      .select('*')
      .order('id', { ascending: true })
    
    // 2. Загружаем магазины
    const { data: shopsData } = await supabase
      .from('shops')
      .select('*')
      .order('id', { ascending: true })

    if (itemsData) setItems(itemsData)
    if (shopsData) setShops(shopsData)
    
    // Если есть магазины, ставим первый по умолчанию для новых товаров
    if (shopsData && shopsData.length > 0) {
        setNewItemShop(shopsData[0].id)
    }
    
    setLoading(false)
  }

  // --- ОБНОВЛЕНИЕ ДАННЫХ ---

  async function updateLocalAndDb(id, field, value) {
    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, [field]: value } : i))
    await supabase.from('inventory_items').update({ [field]: value }).eq('id', id)
  }

  // Изменение количества (+/-)
  async function updateQuantityDelta(id, currentQty, change) {
    const newQty = parseInt(currentQty) + change
    if (newQty < 0) return
    updateLocalAndDb(id, 'current_quantity', newQty)
  }

  // Ручной ввод количества
  async function handleManualQuantityChange(id, newValue) {
    let val = parseInt(newValue)
    if (isNaN(val) || val < 0) val = 0
    updateLocalAndDb(id, 'current_quantity', val)
  }

  // Изменение порога (+/-)
  async function updateThresholdDelta(id, currentThreshold, change) {
    const newThreshold = parseInt(currentThreshold) + change
    if (newThreshold < 0) return
    updateLocalAndDb(id, 'min_threshold', newThreshold)
  }

  // Ручной ввод порога
  async function handleManualThresholdChange(id, newValue) {
    let val = parseInt(newValue)
    if (isNaN(val) || val < 0) val = 0
    updateLocalAndDb(id, 'min_threshold', val)
  }

  // Смена магазина у товара
  async function updateItemShop(id, newShopId) {
      updateLocalAndDb(id, 'shop_id', newShopId)
  }

  // --- СОЗДАНИЕ И УДАЛЕНИЕ ---

  async function addNewItem() {
    if (!newItemName.trim()) return

    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{ 
        name: newItemName, 
        current_quantity: 0, 
        min_threshold: 1,
        unit: newItemUnit,
        shop_id: newItemShop || null
      }])
      .select()

    if (!error && data) {
      setItems([...items, ...data])
      setNewItemName('')
      setNewItemUnit('шт')
    }
  }

  async function deleteItem(id) {
    if (!confirm('Удалить товар?')) return
    setItems(items.filter(i => i.id !== id))
    await supabase.from('inventory_items').delete().eq('id', id)
  }

  async function markAsBought(id, currentQty, minThreshold) {
      let addAmount = 1;
      if (minThreshold > currentQty + 1) {
          addAmount = minThreshold - currentQty;
      }
      updateQuantityDelta(id, currentQty, addAmount)
  }

  // --- ГРУППИРОВКА СПИСКА ПОКУПОК ---
  
  const shoppingList = items.filter(i => i.current_quantity < i.min_threshold)
  const itemsToBuyCount = shoppingList.length

  // Группируем товары по ID магазина
  const groupedShoppingList = shoppingList.reduce((acc, item) => {
      const shopId = item.shop_id || 'unknown'; // Если магазина нет
      if (!acc[shopId]) acc[shopId] = [];
      acc[shopId].push(item);
      return acc;
  }, {});

  // Вспомогательная функция, чтобы найти имя магазина по ID
  const getShopName = (id) => {
      if (id === 'unknown') return 'Не определено (Назначьте магазин!)';
      const shop = shops.find(s => s.id == id);
      return shop ? shop.name : 'Неизвестный магазин';
  }

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Life ERP
          </Typography>
        </Toolbar>
        <Tabs 
            value={tabIndex} 
            onChange={(e, newVal) => setTabIndex(newVal)} 
            textColor="inherit" 
            indicatorColor="secondary"
            variant="fullWidth"
        >
            <Tab icon={<Inventory />} label="Склад" />
            <Tab 
                icon={
                    <Badge badgeContent={itemsToBuyCount} color="error">
                        <ShoppingCart />
                    </Badge>
                } 
                label="Купить" 
            />
        </Tabs>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 3, pb: 4 }}>

        {/* --- Вкл 1: СКЛАД --- */}
        {tabIndex === 0 && (
          <>
            {/* Карточка добавления */}
            <Card sx={{ p: 2, mb: 3 }}>
                <Box display="flex" flexDirection="column" gap={2}>
                    <TextField 
                        fullWidth
                        label="Название товара" 
                        variant="outlined" 
                        size="small"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                    />
                    <Box display="flex" gap={1}>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <InputLabel>Ед.</InputLabel>
                            <Select
                                value={newItemUnit}
                                label="Ед."
                                onChange={(e) => setNewItemUnit(e.target.value)}
                            >
                                <MenuItem value="шт">шт</MenuItem>
                                <MenuItem value="кг">кг</MenuItem>
                                <MenuItem value="л">л</MenuItem>
                                <MenuItem value="уп">уп</MenuItem>
                                <MenuItem value="гр">гр</MenuItem>
                            </Select>
                        </FormControl>

                        {/* Выбор магазина при создании */}
                        <FormControl size="small" fullWidth>
                            <InputLabel>Магазин</InputLabel>
                            <Select
                                value={newItemShop}
                                label="Магазин"
                                onChange={(e) => setNewItemShop(e.target.value)}
                            >
                                {shops.map(shop => (
                                    <MenuItem key={shop.id} value={shop.id}>{shop.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button variant="contained" onClick={addNewItem}><Add /></Button>
                    </Box>
                </Box>
            </Card>

            <Box display="flex" flexDirection="column" gap={2}>
              {items.map(item => {
                 const isLow = item.current_quantity < item.min_threshold;
                 const unitLabel = item.unit || 'шт'; 

                 return (
                  <Card key={item.id} sx={{ borderLeft: isLow ? '5px solid red' : '5px solid green' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Box>
                            <Typography variant="h6" sx={{ lineHeight: 1 }}>{item.name}</Typography>
                            {/* Выбор магазина для уже созданного товара */}
                            <Select
                                variant="standard"
                                value={item.shop_id || ''}
                                onChange={(e) => updateItemShop(item.id, e.target.value)}
                                displayEmpty
                                sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.5, minWidth: 100 }}
                            >
                                <MenuItem value="" disabled>Choose Shop</MenuItem>
                                {shops.map(shop => (
                                    <MenuItem key={shop.id} value={shop.id}>{shop.name}</MenuItem>
                                ))}
                            </Select>
                        </Box>

                        <Chip 
                            label={isLow ? "Купить" : "OK"} 
                            color={isLow ? "error" : "success"} 
                            size="small"
                            variant={isLow ? "filled" : "outlined"}
                        />
                      </Box>
                      
                      <Grid container spacing={2} alignItems="center" mt={1}>
                          {/* ФАКТ */}
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Есть ({unitLabel})</Typography>
                            <Box display="flex" alignItems="center">
                                <IconButton size="small" onClick={() => updateQuantityDelta(item.id, item.current_quantity, -1)}><Remove /></IconButton>
                                <TextField 
                                    variant="standard"
                                    type="number"
                                    value={item.current_quantity}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setItems(items.map(i => i.id === item.id ? { ...i, current_quantity: val } : i))
                                    }}
                                    onBlur={(e) => handleManualQuantityChange(item.id, e.target.value)}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                    sx={{ width: 50 }}
                                />
                                <IconButton size="small" onClick={() => updateQuantityDelta(item.id, item.current_quantity, 1)}><Add /></IconButton>
                            </Box>
                          </Grid>

                          {/* ПОРОГ */}
                          <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Мин ({unitLabel})</Typography>
                              <Box display="flex" alignItems="center" sx={{ border: '1px solid #eee', borderRadius: 1, px: 1 }}>
                                <IconButton size="small" onClick={() => updateThresholdDelta(item.id, item.min_threshold, -1)}><Remove fontSize="small"/></IconButton>
                                <TextField 
                                    variant="standard"
                                    type="number"
                                    value={item.min_threshold}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setItems(items.map(i => i.id === item.id ? { ...i, min_threshold: val } : i))
                                    }}
                                    onBlur={(e) => handleManualThresholdChange(item.id, e.target.value)}
                                    inputProps={{ style: { textAlign: 'center', fontSize: '14px' } }}
                                    sx={{ width: 40 }}
                                />
                                <IconButton size="small" onClick={() => updateThresholdDelta(item.id, item.min_threshold, 1)}><Add fontSize="small"/></IconButton>
                              </Box>
                          </Grid>
                      </Grid>
                      
                      <Box display="flex" justifyContent="flex-end">
                         <IconButton size="small" onClick={() => deleteItem(item.id)} color="default"><Delete fontSize="small"/></IconButton>
                      </Box>

                    </CardContent>
                  </Card>
                 )
              })}
            </Box>
          </>
        )}

        {/* --- Вкл 2: СПИСОК ПОКУПОК (Группировка) --- */}
        {tabIndex === 1 && (
            <Box display="flex" flexDirection="column" gap={3}>
                {shoppingList.length === 0 ? (
                    <Typography align="center" color="text.secondary" mt={4}>
                        Всего хватает! 🎉
                    </Typography>
                ) : (
                    // Пробегаемся по группам магазинов
                    Object.keys(groupedShoppingList).map(shopId => (
                        <Paper key={shopId} elevation={3} sx={{ overflow: 'hidden' }}>
                            {/* Заголовок Магазина */}
                            <Box sx={{ bgcolor: '#1976d2', color: 'white', p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Storefront fontSize="small"/>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    {getShopName(shopId)}
                                </Typography>
                            </Box>
                            
                            {/* Список товаров в этом магазине */}
                            <List dense>
                                {groupedShoppingList[shopId].map((item, index) => {
                                    const deficit = item.min_threshold - item.current_quantity;
                                    const unitLabel = item.unit || 'шт';
                                    return (
                                        <div key={item.id}>
                                            <ListItem 
                                                secondaryAction={
                                                    <Button 
                                                        variant="contained" 
                                                        size="small"
                                                        color="success"
                                                        onClick={() => markAsBought(item.id, item.current_quantity, item.min_threshold)}
                                                    >
                                                        Купил
                                                    </Button>
                                                }
                                            >
                                                <ListItemText 
                                                    primary={
                                                        <Typography variant="body1" fontWeight="medium">
                                                            {item.name}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Typography variant="body2" color="error">
                                                            Взять: <b>{deficit > 0 ? deficit : 1} {unitLabel}</b>
                                                        </Typography>
                                                    }
                                                />
                                            </ListItem>
                                            {index < groupedShoppingList[shopId].length - 1 && <Divider />}
                                        </div>
                                    )
                                })}
                            </List>
                        </Paper>
                    ))
                )}
            </Box>
        )}

      </Container>
    </Box>
  )
}

export default App