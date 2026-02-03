import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

import { 
  Container, Typography, TextField, Button, Card, CardContent, 
  IconButton, Box, AppBar, Toolbar, Chip,
  Tabs, Tab, Badge, Grid, Select, MenuItem, InputLabel, FormControl
} from '@mui/material'

import { 
  Add, Remove, Delete, ShoppingCart, Inventory, CheckCircle 
} from '@mui/icons-material'

function App() {
  const [items, setItems] = useState([]) 
  const [loading, setLoading] = useState(true)
  
  // Состояния для формы добавления
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('шт') 

  const [tabIndex, setTabIndex] = useState(0)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('id', { ascending: true })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  // --- УНИВЕРСАЛЬНЫЕ ФУНКЦИИ ОБНОВЛЕНИЯ ---

  // 1. Изменение кнопками +/-
  async function updateQuantityDelta(id, currentQty, change) {
    const newQty = parseInt(currentQty) + change
    if (newQty < 0) return
    updateLocalAndDb(id, 'current_quantity', newQty)
  }

  // 2. Изменение ручным вводом (Input)
  async function handleManualQuantityChange(id, newValue) {
    let val = parseInt(newValue)
    if (isNaN(val) || val < 0) val = 0
    updateLocalAndDb(id, 'current_quantity', val)
  }

  // То же самое для Порога (Threshold)
  async function updateThresholdDelta(id, currentThreshold, change) {
    const newThreshold = parseInt(currentThreshold) + change
    if (newThreshold < 0) return
    updateLocalAndDb(id, 'min_threshold', newThreshold)
  }

  async function handleManualThresholdChange(id, newValue) {
    let val = parseInt(newValue)
    if (isNaN(val) || val < 0) val = 0
    updateLocalAndDb(id, 'min_threshold', val)
  }

  // Единая функция сохранения
  async function updateLocalAndDb(id, field, value) {
    // Сначала обновляем интерфейс (быстро)
    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, [field]: value } : i))
    // Потом шлем в базу (фоном)
    await supabase.from('inventory_items').update({ [field]: value }).eq('id', id)
  }

  async function addNewItem() {
    if (!newItemName.trim()) return

    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{ 
        name: newItemName, 
        current_quantity: 0, 
        min_threshold: 1,
        unit: newItemUnit 
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
      // Логика покупки: Если текущее < минимума, то пополняем до минимума + чуть-чуть (или просто +10%?)
      // Пока сделаем так: если картошки 0, а надо 3000 -> станет 3000.
      // Если покупка штучная (шт), то +1.
      
      // Простая логика: пополняем ровно до Порога, если текущего меньше
      let addAmount = 1;
      if (minThreshold > currentQty + 1) {
          addAmount = minThreshold - currentQty;
      }
      
      updateQuantityDelta(id, currentQty, addAmount)
  }

  const shoppingList = items.filter(i => i.current_quantity < i.min_threshold)
  const itemsToBuyCount = shoppingList.length

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

        {/* --- СКЛАД --- */}
        {tabIndex === 0 && (
          <>
            <Card sx={{ p: 2, mb: 3 }}>
                <Box display="flex" gap={1}>
                    <TextField 
                        sx={{ flexGrow: 1 }}
                        label="Название" 
                        variant="outlined" 
                        size="small"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                    />
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
                    <Button variant="contained" onClick={addNewItem}><Add /></Button>
                </Box>
            </Card>

            <Box display="flex" flexDirection="column" gap={2}>
              {items.map(item => {
                 const isLow = item.current_quantity < item.min_threshold;
                 const unitLabel = item.unit || 'шт'; 

                 return (
                  <Card key={item.id} sx={{ borderLeft: isLow ? '5px solid red' : '5px solid green' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6">{item.name}</Typography>
                        {/* Бейджик показывает статус */}
                        <Chip 
                            label={isLow ? "Надо купить" : "OK"} 
                            color={isLow ? "error" : "success"} 
                            size="small"
                            variant={isLow ? "filled" : "outlined"}
                        />
                      </Box>
                      
                      <Grid container spacing={2} alignItems="center">
                          {/* ФАКТ */}
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Есть ({unitLabel})</Typography>
                            <Box display="flex" alignItems="center">
                                <IconButton size="small" onClick={() => updateQuantityDelta(item.id, item.current_quantity, -1)}><Remove /></IconButton>
                                {/* Поле ввода количества */}
                                <TextField 
                                    variant="standard"
                                    type="number"
                                    value={item.current_quantity}
                                    onChange={(e) => {
                                        // Меняем локально пока печатаем
                                        const val = e.target.value;
                                        setItems(items.map(i => i.id === item.id ? { ...i, current_quantity: val } : i))
                                    }}
                                    onBlur={(e) => handleManualQuantityChange(item.id, e.target.value)}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                    sx={{ width: 60 }}
                                />
                                <IconButton size="small" onClick={() => updateQuantityDelta(item.id, item.current_quantity, 1)}><Add /></IconButton>
                            </Box>
                          </Grid>

                          {/* ПОРОГ */}
                          <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Порог ({unitLabel})</Typography>
                              <Box display="flex" alignItems="center" sx={{ border: '1px solid #eee', borderRadius: 1, px: 1 }}>
                                <IconButton size="small" onClick={() => updateThresholdDelta(item.id, item.min_threshold, -1)}><Remove fontSize="small"/></IconButton>
                                {/* Поле ввода порога */}
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
                                    sx={{ width: 50 }}
                                />
                                <IconButton size="small" onClick={() => updateThresholdDelta(item.id, item.min_threshold, 1)}><Add fontSize="small"/></IconButton>
                              </Box>
                          </Grid>
                      </Grid>
                      
                      <Box display="flex" justifyContent="flex-end" mt={1}>
                         <IconButton size="small" onClick={() => deleteItem(item.id)} color="default"><Delete fontSize="small"/></IconButton>
                      </Box>

                    </CardContent>
                  </Card>
                 )
              })}
            </Box>
          </>
        )}

        {/* --- СПИСОК ПОКУПОК --- */}
        {tabIndex === 1 && (
            <Box display="flex" flexDirection="column" gap={2}>
                {shoppingList.length === 0 ? (
                    <Typography align="center" color="text.secondary" mt={4}>
                        Всего хватает!
                    </Typography>
                ) : (
                    shoppingList.map(item => {
                        const unitLabel = item.unit || 'шт';
                        // Вычисляем дефицит
                        const deficit = item.min_threshold - item.current_quantity;
                        
                        return (
                        <Card key={item.id}>
                            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="h6">{item.name}</Typography>
                                    <Typography variant="body2" color="error">
                                        Купить: <b>{deficit > 0 ? deficit : 1} {unitLabel}</b>
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        (Есть {item.current_quantity} из {item.min_threshold})
                                    </Typography>
                                </Box>
                                <Button 
                                    variant="contained" 
                                    onClick={() => markAsBought(item.id, item.current_quantity, item.min_threshold)}
                                >
                                    Купил
                                </Button>
                            </CardContent>
                        </Card>
                    )})
                )}
            </Box>
        )}

      </Container>
    </Box>
  )
}

export default App